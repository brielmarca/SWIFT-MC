import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { createTestPrisma, hasDatabase } from "./helpers";

const db = hasDatabase ? createTestPrisma()! : undefined;
const prefix = `prov-${randomUUID()}`;

async function cleanup() {
  if (!db) return;
  const users = await db.user.findMany({ where: { displayName: { startsWith: prefix } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await db.provisionedAdmin.deleteMany({
    where: {
      OR: [
        { discordSubject: { startsWith: prefix } },
        { claimedByUserId: { in: userIds } },
        { grantedByUserId: { in: userIds } },
      ],
    },
  });
  await db.authAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
  await db.authIdentity.deleteMany({ where: { userId: { in: userIds } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
}

after(async () => {
  if (!db) return;
  try {
    await cleanup();
  } finally {
    await db.$disconnect();
  }
});

async function createDiscordUser(label: string, discordSubject = `${prefix}-${label}`) {
  assert.ok(db);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        displayName: `${prefix}-${label}`,
        role: "USER",
        status: "ACTIVE",
        authVersion: 1,
      },
    });
    await tx.authIdentity.create({
      data: {
        userId: user.id,
        provider: "DISCORD",
        providerSubject: discordSubject,
      },
    });
    return { user, discordSubject };
  });
}

async function createProvision(discordSubject: string, targetRole: "ADMIN" | "OWNER") {
  assert.ok(db);
  return db.provisionedAdmin.create({
    data: { discordSubject, targetRole },
  });
}

async function claimProvision(id: string, userId: string) {
  assert.ok(db);
  const now = new Date();
  return db.provisionedAdmin.update({
    where: { id },
    data: { claimedByUserId: userId, claimedAt: now, consumedAt: now },
  });
}

test("legitimate ADMIN claim grants role, bumps authVersion once, and consumes claim", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const { user, discordSubject } = await createDiscordUser("admin-ok", `${prefix}-11111111111111111`);
  const provision = await createProvision(discordSubject, "ADMIN");

  const claimed = await claimProvision(provision.id, user.id);
  assert.equal(claimed.claimedByUserId, user.id);
  assert.ok(claimed.claimedAt);
  assert.ok(claimed.consumedAt);

  const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(refreshed.role, "ADMIN");
  assert.equal(refreshed.authVersion, 2);
});

test("legitimate OWNER claim grants role when no OWNER exists", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const { user, discordSubject } = await createDiscordUser("owner-ok", `${prefix}-22222222222222222`);
  const provision = await createProvision(discordSubject, "OWNER");

  await claimProvision(provision.id, user.id);
  const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(refreshed.role, "OWNER");
  assert.equal(refreshed.authVersion, 2);
});

test("direct role escalation is blocked outside authorized claim flow", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const { user } = await createDiscordUser("direct", `${prefix}-33333333333333333`);
  await assert.rejects(
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    /User role mutation is restricted/,
  );
  await assert.rejects(
    db.user.update({ where: { id: user.id }, data: { role: "OWNER" } }),
    /User role mutation is restricted/,
  );
  const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(refreshed.role, "USER");
  assert.equal(refreshed.authVersion, 1);
});

test("improper claim is rejected for mismatched Discord identity/user and leaves state unchanged", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const { user: rightful } = await createDiscordUser("rightful", `${prefix}-44444444444444444`);
  const { user: intruder } = await createDiscordUser("intruder", `${prefix}-55555555555555555`);
  const provision = await createProvision(`${prefix}-44444444444444444`, "ADMIN");

  await assert.rejects(claimProvision(provision.id, intruder.id), /owner mismatch|matching DISCORD identity/);
  const row = await db.provisionedAdmin.findUniqueOrThrow({ where: { id: provision.id } });
  assert.equal(row.claimedByUserId, null);
  assert.equal(row.consumedAt, null);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: intruder.id } })).role, "USER");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: rightful.id } })).role, "USER");

  const noIdentityProvision = await createProvision(`${prefix}-99999999999999999`, "ADMIN");
  await assert.rejects(claimProvision(noIdentityProvision.id, rightful.id), /matching DISCORD identity/);
});

test("claim replay and consumed claim mutation are rejected", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const { user, discordSubject } = await createDiscordUser("replay", `${prefix}-66666666666666666`);
  const { user: other } = await createDiscordUser("replay-other", `${prefix}-77777777777777777`);
  const provision = await createProvision(discordSubject, "ADMIN");
  await claimProvision(provision.id, user.id);

  await assert.rejects(claimProvision(provision.id, user.id), /immutable/);
  const now = new Date();
  await assert.rejects(
    db.provisionedAdmin.update({ where: { id: provision.id }, data: { claimedByUserId: other.id, claimedAt: now, consumedAt: now } }),
    /immutable/,
  );
  const refreshed = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(refreshed.role, "ADMIN");
  assert.equal(refreshed.authVersion, 2);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: other.id } })).role, "USER");
});

test("second OWNER cannot be created after OWNER exists", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const first = await createDiscordUser("owner-first", `${prefix}-88888888888888881`);
  const second = await createDiscordUser("owner-second", `${prefix}-88888888888888882`);
  const p1 = await createProvision(first.discordSubject, "OWNER");
  const p2 = await createProvision(second.discordSubject, "OWNER");
  await claimProvision(p1.id, first.user.id);

  await assert.rejects(claimProvision(p2.id, second.user.id), /Owner already exists/);
  const p2row = await db.provisionedAdmin.findUniqueOrThrow({ where: { id: p2.id } });
  assert.equal(p2row.claimedByUserId, null);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: first.user.id } })).role, "OWNER");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: second.user.id } })).role, "USER");
});

test("concurrent OWNER claims allow exactly one success", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  await cleanup();
  const a = await createDiscordUser("owner-race-a", `${prefix}-88888888888888891`);
  const b = await createDiscordUser("owner-race-b", `${prefix}-88888888888888892`);
  const pa = await createProvision(a.discordSubject, "OWNER");
  const pb = await createProvision(b.discordSubject, "OWNER");

  const outcomes = await Promise.allSettled([claimProvision(pa.id, a.user.id), claimProvision(pb.id, b.user.id)]);
  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  const rejected = outcomes.filter((o) => o.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const owners = await db.user.count({ where: { id: { in: [a.user.id, b.user.id] }, role: "OWNER" } });
  assert.equal(owners, 1);
  const claims = await db.provisionedAdmin.findMany({ where: { id: { in: [pa.id, pb.id] } } });
  assert.equal(claims.filter((c) => c.claimedByUserId).length, 1);
});
