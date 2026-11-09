import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, mock } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createTestPrisma } from "./helpers";
import { buildAuthServices, withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { createEmailVerificationService } from "@/lib/auth-domain/email-verification";
import { SystemClock } from "@/lib/auth-domain/clock";
import { PrismaPasswordCredentialRepository } from "@/lib/auth-persistence/prisma-password-repository";
import { digestSecurityToken } from "@/lib/auth/tokens";

const db = createTestPrisma()!;
const services = buildAuthServices(db);
const prefix = randomUUID();
const requestId = prefix;
const emails: string[] = [];
const password = "Database-Test-Password-123!";
const env = {
  AUTH_HYPERDRIVE: { connectionString: process.env.TEST_DATABASE_URL! },
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};
// Only the Cloudflare environment/binding is substituted; session validation,
// Prisma, transactions, password hashing and authorization remain real.
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
const { GET: ordersGET } = await import("@/app/api/user/orders/route");
const { POST: ordersPOST } = await import("@/app/api/orders/route");

after(async () => {
  try {
    const users = await db.user.findMany({ where: { emailNormalized: { in: emails } } });
    const ids = users.map((user) => user.id);
    await db.order.deleteMany({ where: { checkoutIdempotencyKey: { startsWith: prefix } } });
    // Current domain services sanitize requestId out before append, persisting
    // an empty correlation ID. This is the only auth suite in this private DB.
    await db.authAuditEvent.deleteMany({ where: { requestId: { in: [requestId, ""] } } });
    await db.emailChallenge.deleteMany({ where: { emailNormalized: { in: emails } } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.authIdentity.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally { await db.$disconnect(); }
});

async function registrationRequest() {
  const email = `${randomUUID()}@integration.invalid`;
  emails.push(email);
  const result = await services.registrationService.requestRegistration({ email, requestId });
  assert.ok(result.challengeToken);
  return { email, challengeToken: result.challengeToken, password, displayName: "Integration", requestId };
}
async function complete(params: Awaited<ReturnType<typeof registrationRequest>>) {
  return db.$transaction(async (tx) => createEmailVerificationService({
    ...buildAuthServices(tx as unknown as PrismaClient).repositories, clock: new SystemClock(),
  }).completeRegistration(params));
}
async function account() {
  const params = await registrationRequest();
  const result = await complete(params);
  assert.ok(result.ok);
  return { ...params, userId: result.userId };
}
async function login(email: string, candidate = password) {
  return withAuthTransaction(env, (s) => s.loginService.login({ email, password: candidate, rememberMe: false, requestId }));
}

test("registration persists verified identity and hash; token replay and email substitution fail", async () => {
  const params = await registrationRequest();
  assert.equal(await db.user.count({ where: { emailNormalized: params.email } }), 0);
  const result = await complete(params);
  assert.ok(result.ok);
  const user = await db.user.findUniqueOrThrow({ where: { id: result.userId }, include: { identities: { include: { passwordCredential: true } } } });
  assert.ok(user.emailVerifiedAt);
  assert.equal(user.role, "USER");
  assert.equal(user.authVersion, 1);
  assert.notEqual(user.identities[0].passwordCredential!.passwordHash, password);
  assert.equal((await complete(params)).ok, false);
  const other = await registrationRequest();
  await assert.rejects(complete({ ...other, email: params.email }), /VERIFICATION_FAILED/);
  const duplicate = await services.registrationService.requestRegistration({ email: params.email, requestId });
  assert.equal(duplicate.challengeToken, undefined);
});

test("expired registration challenge cannot create an account", async () => {
  const params = await registrationRequest();
  await db.emailChallenge.updateMany({ where: { emailNormalized: params.email }, data: { createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000) } });
  assert.equal((await complete(params)).ok, false);
  assert.equal(await db.user.count({ where: { emailNormalized: params.email } }), 0);
});

test("login rotates sessions; logout and revoke-all invalidate persisted tokens", async () => {
  const user = await account();
  assert.equal((await login(user.email, "wrong-password")).ok, false);
  const first = await login(user.email);
  assert.ok(first.ok);
  assert.equal((await services.sessionService.validateSession({ token: first.rawToken })).ok, true);
  const second = await login(user.email);
  assert.ok(second.ok);
  assert.equal((await services.sessionService.validateSession({ token: first.rawToken })).ok, false);
  await services.sessionService.revokeSession(second.session.id);
  assert.equal((await services.sessionService.validateSession({ token: second.rawToken })).ok, false);
  const sessions = await Promise.all([1, 2].map(() => services.sessionService.issueSession({ userId: user.userId, authVersion: 1, rememberMe: false, isStaff: false })));
  await services.sessionService.revokeAllUserSessions(user.userId);
  for (const session of sessions) {
    assert.ok(session.ok);
    assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, false);
  }
});

test("password reset and change persist new hashes, bump versions and revoke sessions", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const reset = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(reset.challengeToken);
  const params = { email: user.email, challengeToken: reset.challengeToken, newPassword: `${password}reset`, requestId };
  assert.equal((await withAuthTransaction(env, (s) => s.passwordResetService.completePasswordReset(params))).ok, true);
  assert.equal((await withAuthTransaction(env, (s) => s.passwordResetService.completePasswordReset(params))).ok, false);
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, false);
  assert.equal((await login(user.email)).ok, false);
  const resetSession = await login(user.email, params.newPassword);
  assert.ok(resetSession.ok);
  assert.equal((await withAuthTransaction(env, (s) => s.loginService.changePassword({ email: user.email, currentPassword: "wrong", newPassword: `${password}changed`, requestId }))).ok, false);
  assert.equal((await withAuthTransaction(env, (s) => s.loginService.changePassword({ email: user.email, currentPassword: params.newPassword, newPassword: `${password}changed`, requestId }))).ok, true);
  assert.equal((await services.sessionService.validateSession({ token: resetSession.rawToken })).ok, false);
  assert.equal((await login(user.email, params.newPassword)).ok, false);
  assert.equal((await login(user.email, `${password}changed`)).ok, true);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.userId } })).authVersion, 3);
});

test("real transactions roll back registration and all password reset mutations", async () => {
  const params = await registrationRequest();
  await assert.rejects(db.$transaction(async (tx) => {
    const result = await createEmailVerificationService({ ...buildAuthServices(tx as unknown as PrismaClient).repositories, clock: new SystemClock() }).completeRegistration(params);
    assert.ok(result.ok);
    throw new Error("injected transaction failure");
  }), /injected transaction failure/);
  assert.equal(await db.user.count({ where: { emailNormalized: params.email } }), 0);
  const challenge = await db.emailChallenge.findUniqueOrThrow({ where: { tokenHash: digestSecurityToken(params.challengeToken, "email-register") } });
  assert.equal(challenge.consumedAt, null);
  const registered = await complete(params);
  assert.ok(registered.ok);
  const session = await login(params.email);
  assert.ok(session.ok);
  const reset = await services.passwordResetService.requestPasswordReset({ email: params.email, requestId });
  assert.ok(reset.challengeToken);
  const before = await db.user.findUniqueOrThrow({ where: { id: registered.userId } });
  await assert.rejects(withAuthTransaction(env, async (s) => {
    assert.equal((await s.passwordResetService.completePasswordReset({ email: params.email, challengeToken: reset.challengeToken!, newPassword: `${password}rollback`, requestId })).ok, true);
    throw new Error("injected transaction failure");
  }), /injected transaction failure/);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: registered.userId } })).authVersion, before.authVersion);
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, true);
  assert.equal((await db.emailChallenge.findUniqueOrThrow({ where: { tokenHash: digestSecurityToken(reset.challengeToken, "password-reset") } })).consumedAt, null);
  assert.equal((await login(params.email)).ok, true);
});

test("concurrent login failures lock at five; correct password cannot bypass or extend 15-minute lock", async () => {
  const user = await account();
  const outcomes = await Promise.all(Array.from({ length: 8 }, () => login(user.email, "incorrect")));
  assert.ok(outcomes.every((result) => !result.ok));
  const identity = await db.authIdentity.findFirstOrThrow({ where: { userId: user.userId } });
  const state = () => db.passwordCredential.findUniqueOrThrow({ where: { identityId: identity.id } });
  const locked = await state();
  assert.equal(locked.failedLoginAttempts, 5);
  const [{ remaining }] = await db.$queryRaw<Array<{ remaining: number }>>`SELECT EXTRACT(EPOCH FROM ("lockedUntil" - statement_timestamp()))::float8 AS remaining FROM "PasswordCredential" WHERE "identityId" = ${identity.id}`;
  assert.ok(remaining > 14 * 60 && remaining <= 15 * 60);
  assert.equal((await login(user.email)).ok, false);
  assert.deepEqual(await state(), locked);
  const other = await account();
  assert.equal((await login(other.email)).ok, true);
  // Move only this fixture's deadline; no wall-clock mocking or 15-minute sleep.
  await db.$executeRaw`UPDATE "PasswordCredential" SET "lockedUntil" = statement_timestamp() - INTERVAL '1 millisecond' WHERE "identityId" = ${identity.id}`;
  assert.equal((await login(user.email, "incorrect")).ok, false);
  assert.equal((await state()).failedLoginAttempts, 1);
  assert.equal((await state()).lockedUntil, null);
  assert.equal((await login(user.email)).ok, true);
  assert.equal((await state()).failedLoginAttempts, 0);
  assert.equal(await new PrismaPasswordCredentialRepository(db).recordLoginAttempt(identity.id, "stale-hash", true), false);
});

test("orders endpoint enforces real session ownership, excluding foreign and guest orders", async () => {
  const owner = await account();
  const stranger = await account();
  const session = await login(owner.email);
  assert.ok(session.ok);
  const numbers: string[] = [];
  for (const userId of [owner.userId, stranger.userId, null]) {
    const key = `${prefix}-${randomUUID()}`;
    const order = await db.order.create({ data: {
      userId, publicToken: randomUUID(), orderNumber: key, checkoutIdempotencyKey: key,
      rankSlug: "swift", rankName: "Swift", rankDuration: "test", minecraftUsername: "TestPlayer",
      email: owner.email, subtotalCents: 100, totalCents: 100, expiresAt: new Date(Date.now() + 60_000),
    } });
    numbers.push(order.orderNumber);
  }
  const request = (token?: string) => new Request("https://swift.example/api/user/orders?page=1&pageSize=20", {
    headers: token ? { cookie: `__Host-swiftmc_session=${token}` } : {},
  });
  assert.equal((await ordersGET(request())).status, 401);
  const response = await ordersGET(request(session.rawToken));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.orders.map((order: { orderNumber: string }) => order.orderNumber), [numbers[0]]);
  assert.equal(body.pagination.total, 1);
  assert.equal(body.orders[0].publicToken, undefined);
  assert.equal((await ordersPOST(request(session.rawToken))).status, 503, "authenticated checkout remains disabled");
  await services.sessionService.revokeSession(session.session.id);
  assert.equal((await ordersGET(request(session.rawToken))).status, 401);
});
