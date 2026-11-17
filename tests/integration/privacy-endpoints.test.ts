import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, mock } from "node:test";
import { createTestPrisma, hasDatabase } from "./helpers";
import { buildAuthServices } from "@/lib/auth-api/auth-stack";

// Disposable PostgreSQL only. This suite never connects to staging/production.
const db = createTestPrisma();
const prefix = "privacy-" + randomUUID();
const users: string[] = [];
const grants: string[] = [];
const host = "https://swift.example";
const env = {
  APP_URL: host,
  AUTH_HYPERDRIVE: { connectionString: process.env.TEST_DATABASE_URL! },
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/prisma", { namedExports: { getPrisma: () => db } });
const { GET: listSelf, POST: createSelf } = await import("@/app/api/user/privacy-requests/route");
const { GET: getSelf } = await import("@/app/api/user/privacy-requests/[id]/route");
const { GET: listAdmin } = await import("@/app/api/admin/privacy-requests/route");
const { PATCH: patchAdmin } = await import("@/app/api/admin/privacy-requests/[id]/route");

function request(path: string, method: string, token?: string, data?: object,
  extra: Record<string, string> = {}): Request {
  const headers = new Headers({
    "content-type": "application/json", origin: host, "sec-fetch-site": "same-origin",
    "x-csrf-token": "privacy-csrf", ...extra,
  });
  if (token) headers.set("cookie", `__Host-swiftmc_session=${token}; __Host-swiftmc_csrf=privacy-csrf`);
  return new Request(host + path, {
    method, headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
}

async function createAccount(label: string, role: "USER" | "ADMIN" | "OWNER" = "USER",
  mfa = false): Promise<{ id: string; token: string }> {
  assert.ok(db);
  const email = `${label}-${randomUUID()}@privacy.invalid`;
  const user = await db.user.create({ data: { displayName: `${prefix}-${label}`, emailNormalized: email } });
  users.push(user.id);
  let authVersion = user.authVersion;
  if (role !== "USER") {
    // Legitimate claim-driven promotion; no bypass role update.
    const discordSubject = randomUUID().replace(/\D/g, "").slice(0, 19).padEnd(19, "3");
    await db.authIdentity.create({ data: { userId: user.id, provider: "DISCORD", providerSubject: discordSubject } });
    const grant = await db.provisionedAdmin.create({ data: { discordSubject, targetRole: role } });
    grants.push(grant.id);
    await db.provisionedAdmin.update({
      where: { id: grant.id },
      data: { claimedByUserId: user.id, claimedAt: new Date(), consumedAt: new Date() },
    });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updated.role, role);
    authVersion = updated.authVersion;
  }
  const session = await buildAuthServices(db).sessionService.issueSession({
    userId: user.id, authVersion, rememberMe: false, isStaff: role !== "USER",
    ...(mfa ? { mfaVerifiedAt: new Date() } : {}),
  });
  assert.equal(session.ok, true);
  return { id: user.id, token: session.rawToken };
}

after(async () => {
  if (!db) return;
  try {
    if (users.length) {
      await db.authAuditEvent.deleteMany({ where: { OR: [
        { actorUserId: { in: users } }, { subjectUserId: { in: users } },
      ] } });
      await db.privacyRequest.deleteMany({ where: { userId: { in: users } } });
      await db.session.deleteMany({ where: { userId: { in: users } } });
      await db.provisionedAdmin.deleteMany({ where: { id: { in: grants } } });
      await db.authIdentity.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
    }
  } finally { await db.$disconnect(); }
});

test("privacy POST/GET use real authenticated sessions, ownership and safe deduplication",
  { skip: !hasDatabase }, async () => {
    assert.ok(db);
    const alice = await createAccount("alice");
    const bob = await createAccount("bob");
    assert.equal((await listSelf(request("/api/user/privacy-requests", "GET"))).status, 401);
    const invalidOrigin = request("/api/user/privacy-requests", "POST", alice.token, { kind: "ACCESS" }, { origin: "https://evil.example" });
    assert.equal((await createSelf(invalidOrigin)).status, 403);
    const invalidCsrf = request("/api/user/privacy-requests", "POST", alice.token, { kind: "ACCESS" }, { "x-csrf-token": "wrong" });
    assert.equal((await createSelf(invalidCsrf)).status, 403);
    assert.equal((await createSelf(request("/api/user/privacy-requests", "POST", alice.token, { kind: "ACCESS", userId: bob.id }))).status, 400);
    const created = await createSelf(request("/api/user/privacy-requests", "POST", alice.token, { kind: "ACCESS", details: "My account" }));
    assert.equal(created.status, 201);
    const record = await created.json() as { request: { id: string }; alreadyRequested: boolean };
    assert.equal(record.alreadyRequested, false);
    const saved = await db.privacyRequest.findUniqueOrThrow({ where: { id: record.request.id } });
    assert.equal(saved.userId, alice.id);
    assert.equal(saved.kind, "ACCESS");
    assert.equal((await createSelf(request("/api/user/privacy-requests", "POST", alice.token, { kind: "ACCESS" }))).status, 200);
    assert.equal(await db.privacyRequest.count({ where: { userId: alice.id } }), 1);
    const own = await getSelf(request(`/api/user/privacy-requests/${saved.id}`, "GET", alice.token),
      { params: Promise.resolve({ id: saved.id }) });
    assert.equal(own.status, 200);
    const cross = await getSelf(request(`/api/user/privacy-requests/${saved.id}`, "GET", bob.token),
      { params: Promise.resolve({ id: saved.id }) });
    assert.equal(cross.status, 404);
    const otherList = await listSelf(request("/api/user/privacy-requests", "GET", bob.token));
    assert.equal(otherList.status, 200);
    assert.equal((await otherList.json() as { requests: unknown[] }).requests.length, 0);
    assert.equal((await listSelf(request("/api/user/privacy-requests", "GET", alice.token))).status, 200);
    const audit = await db.authAuditEvent.findFirst({
      where: { eventType: "PRIVACY_REQUEST_CREATED", actorUserId: alice.id },
    });
    assert.ok(audit);
    assert.deepEqual(audit.metadata, { kind: "ACCESS", status: "OPEN" });
});

test("admin privacy endpoints require MFA, enforce owner-only final actions and audit transitions",
  { skip: !hasDatabase }, async () => {
    assert.ok(db);
    const adminWithoutMfa = await createAccount("no-mfa", "ADMIN", false);
    const admin = await createAccount("admin", "ADMIN", true);
    const owner = await createAccount("owner", "OWNER", true);
    const alice = await createAccount("subject");
    const saved = await db.privacyRequest.create({ data: { userId: alice.id, kind: "CORRECTION", details: "Update my name" } });
    const listPath = "/api/admin/privacy-requests?page=1&status=OPEN";
    assert.equal((await listAdmin(request(listPath, "GET", adminWithoutMfa.token))).status, 403);
    assert.equal((await listAdmin(request(listPath, "GET", admin.token))).status, 200);
    assert.equal((await listAdmin(request("/api/admin/privacy-requests?page=0", "GET", admin.token))).status, 400);
    assert.equal((await patchAdmin(
      request(`/api/admin/privacy-requests/${saved.id}`, "PATCH", admin.token,
        { action: "START_REVIEW", expectedStatus: "OPEN" }, { origin: "https://evil.example" }),
      { params: Promise.resolve({ id: saved.id }) }
    )).status, 403);
    const params = { params: Promise.resolve({ id: saved.id }) };
    const patch = (token: string, body: object, extra: Record<string, string> = {}) =>
      patchAdmin(request(`/api/admin/privacy-requests/${saved.id}`, "PATCH", token, body, extra), params);
    assert.equal((await patch(admin.token, { action: "START_REVIEW", expectedStatus: "OPEN" })).status, 200);
    assert.equal((await patch(admin.token, { action: "START_REVIEW", expectedStatus: "OPEN" })).status, 409);
    assert.equal((await patch(admin.token, { action: "COMPLETE", expectedStatus: "IN_REVIEW", attested: true })).status, 403);
    assert.equal((await patch(owner.token, { action: "COMPLETE", expectedStatus: "IN_REVIEW" })).status, 400);
    assert.equal((await patch(owner.token, { action: "COMPLETE", expectedStatus: "IN_REVIEW", attested: true })).status, 200);
    assert.equal((await patch(owner.token, { action: "REJECT", expectedStatus: "IN_REVIEW", attested: true })).status, 409);
    assert.equal((await db.privacyRequest.findUniqueOrThrow({ where: { id: saved.id } })).status, "CLOSED");
    const audit = await db.authAuditEvent.findMany({
      where: { subjectUserId: alice.id, eventType: { startsWith: "PRIVACY_REQUEST_" } },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(audit.length, 2);
    assert.ok(audit.some(e => e.eventType === "PRIVACY_REQUEST_COMPLETED" && e.actorUserId === owner.id));
});
