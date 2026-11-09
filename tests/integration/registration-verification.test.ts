import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, mock } from "node:test";
import { createTestPrisma } from "./helpers";
import { digestSecurityToken, generateSecurityToken } from "@/lib/auth/tokens";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { withVerificationTransaction } from "@/lib/auth-api/verification-transaction";
import { createEmailVerificationService } from "@/lib/auth-domain/email-verification";
import { SystemClock } from "@/lib/auth-domain/clock";

const db = createTestPrisma()!;
const prefix = `h2-${randomUUID()}`;
// Deterministic correlation only; security tokens still use real random bytes.
mock.method(globalThis.crypto, "randomUUID", () => prefix);
const emails: string[] = [];
const password = "Registration-Password-123!";
let allow = true;
let deliveryFails = false;
const mail: Array<{ to: string[]; html: string }> = [];
const env = {
  APP_URL: "https://swift.example", RESEND_API_KEY: "integration-only", EMAIL_FROM: "test@integration.invalid",
  AUTH_HYPERDRIVE: { connectionString: process.env.TEST_DATABASE_URL! },
  AUTH_RATE_LIMIT: { limit: async () => ({ success: allow }) },
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
// Only outbound delivery is replaced: actual provider builds the email/link.
mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
  assert.equal(String(url), "https://api.resend.com/emails");
  if (deliveryFails) return new Response("provider unavailable", { status: 503 });
  mail.push(JSON.parse(String(init?.body)));
  return Response.json({ id: randomUUID() });
});
const { POST: register } = await import("@/app/(auth)/api/register/route");
const { POST: resend } = await import("@/app/(auth)/api/auth/resend-verification/route");
const { POST: verify } = await import("@/app/(auth)/api/verify-email/route");

function email() { const value = `${prefix}-${emails.length}@integration.invalid`; emails.push(value); return value; }
function request(body: object, headers: Record<string, string> = {}) {
  return new Request(`${env.APP_URL}/api/verify-email`, { method: "POST", headers: {
    origin: env.APP_URL, "content-type": "application/json", "sec-fetch-site": "same-origin",
    cookie: "__Host-swiftmc_csrf=integration-csrf", "x-csrf-token": "integration-csrf", ...headers,
  }, body: JSON.stringify(body) });
}
function link(recipient: string) {
  const delivered = mail.filter(m => m.to.includes(recipient)).at(-1);
  assert.ok(delivered);
  const match = delivered.html.match(/href="([^"]+)"/);
  assert.ok(match);
  return new URL(match[1]);
}
async function pending() {
  const recipient = email();
  assert.equal((await register(request({ email: recipient }))).status, 200);
  const url = link(recipient);
  assert.equal(url.pathname, "/verify-email");
  assert.equal(url.origin, env.APP_URL);
  const token = url.searchParams.get("token")!;
  return { email: recipient, challengeToken: token, password, displayName: "H2 Test" };
}
const challenge = (token: string) => db.emailChallenge.findUniqueOrThrow({ where: { tokenHash: digestSecurityToken(token, "email-register") } });
async function existing() {
  const recipient = email();
  const user = await db.user.create({ data: { emailNormalized: recipient, displayName: "Existing", authVersion: 7, emailVerifiedAt: null } });
  const identity = await db.authIdentity.create({ data: { userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: recipient } });
  const credential = await db.passwordCredential.create({ data: { identityId: identity.id, passwordHash: await hashPassword(password) } });
  return { user, credential, email: recipient };
}
after(async () => {
  try {
    const users = await db.user.findMany({ where: { emailNormalized: { in: emails } } });
    const ids = users.map(u => u.id);
    await db.authAuditEvent.deleteMany({ where: { OR: [{ subjectUserId: { in: ids } }, { requestId: prefix }] } });
    await db.emailChallenge.deleteMany({ where: { emailNormalized: { in: emails } } });
    await db.session.deleteMany({ where: { userId: { in: ids } } });
    await db.authIdentity.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  } finally { await db.$disconnect(); }
});

test("email link completes registration with only hashed credentials and a real session", async () => {
  const p = await pending();
  assert.equal(await db.user.count({ where: { emailNormalized: p.email } }), 0);
  const row = await challenge(p.challengeToken);
  assert.equal(row.userId, null);
  assert.equal(row.authVersion, null);
  assert.notEqual(row.tokenHash, p.challengeToken);
  assert.ok(!JSON.stringify(row).includes(password));
  const response = await verify(request(p));
  assert.equal(response.status, 201);
  assert.match(response.headers.get("set-cookie")!, /__Host-swiftmc_session=/);
  const user = await db.user.findUniqueOrThrow({ where: { emailNormalized: p.email }, include: { identities: { include: { passwordCredential: true } }, sessions: true } });
  assert.ok(user.emailVerifiedAt);
  assert.equal(await verifyPassword(password, user.identities[0].passwordCredential!.passwordHash), true);
  assert.equal(user.sessions.length, 1);
  assert.equal((await verify(request(p))).status, 400, "token is single use");
});

test("resend rotates pending registrations and preserves generic acknowledgement", async () => {
  const p = await pending();
  const response = await resend(request({ email: p.email }));
  assert.equal(response.status, 200);
  assert.ok((await challenge(p.challengeToken)).consumedAt);
  assert.equal((await verify(request(p))).status, 400);
  const token = link(p.email).searchParams.get("token")!;
  assert.notEqual(token, p.challengeToken);
  assert.equal((await verify(request({ ...p, challengeToken: token }))).status, 201);
  const before = mail.length;
  assert.deepEqual(await (await resend(request({ email: p.email }))).json(), await response.json());
  assert.equal(mail.length, before, "verified account is not sent another token");
});

test("existing unverified account link verifies without changing password, role or authVersion", async () => {
  const fixture = await existing();
  assert.equal((await resend(request({ email: fixture.email }))).status, 200);
  const url = link(fixture.email);
  assert.equal(url.searchParams.get("mode"), "existing");
  const token = url.searchParams.get("token")!;
  const row = await challenge(token);
  assert.equal(row.userId, fixture.user.id);
  assert.equal(row.authVersion, 7);
  assert.equal((await verify(request({ email: fixture.email, challengeToken: token, password: "attacker-password", displayName: "Attacker" }))).status, 400);
  assert.equal((await challenge(token)).consumedAt, null, "wrong operation rolls back consumption");
  const response = await verify(request({ email: fixture.email, challengeToken: token }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  const user = await db.user.findUniqueOrThrow({ where: { id: fixture.user.id } });
  assert.ok(user.emailVerifiedAt);
  assert.equal(user.authVersion, 7);
  assert.equal(user.displayName, "Existing");
  assert.deepEqual(await db.passwordCredential.findUnique({ where: { identityId: fixture.credential.identityId } }), fixture.credential);
  assert.equal((await verify(request({ email: fixture.email, challengeToken: token }))).status, 400);
});

test("invalid, expired, wrong-email and wrong-purpose tokens cannot register", async () => {
  const p = await pending();
  assert.equal((await verify(request({ ...p, challengeToken: generateSecurityToken("email-register") }))).status, 400);
  assert.equal((await verify(request({ ...p, email: email() }))).status, 400);
  assert.equal((await challenge(p.challengeToken)).consumedAt, null);
  await db.emailChallenge.update({ where: { id: (await challenge(p.challengeToken)).id }, data: { purpose: "PASSWORD_RESET" } });
  assert.equal((await verify(request(p))).status, 400);
  assert.equal((await challenge(p.challengeToken)).consumedAt, null);
  await db.emailChallenge.update({ where: { id: (await challenge(p.challengeToken)).id }, data: { purpose: "REGISTER", expiresAt: new Date(Date.now() - 1000), createdAt: new Date(Date.now() - 600_000) } });
  assert.equal((await verify(request(p))).status, 400);
  assert.equal(await db.user.count({ where: { emailNormalized: p.email } }), 0);
});

test("existing verification rejects stale versions, wrong users and inactive accounts", async () => {
  const fixture = await existing();
  for (const data of [{ authVersion: 6 }, { userId: null }, { purpose: "VERIFY_EMAIL" as const }]) {
    await resend(request({ email: fixture.email }));
    const token = link(fixture.email).searchParams.get("token")!;
    await db.emailChallenge.update({ where: { id: (await challenge(token)).id }, data });
    assert.equal((await verify(request({ email: fixture.email, challengeToken: token }))).status, 400);
    assert.equal((await challenge(token)).consumedAt, null);
  }
  await resend(request({ email: fixture.email }));
  const token = link(fixture.email).searchParams.get("token")!;
  await db.user.update({ where: { id: fixture.user.id }, data: { status: "SUSPENDED" } });
  assert.equal((await verify(request({ email: fixture.email, challengeToken: token }))).status, 400);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: fixture.user.id } })).emailVerifiedAt, null);
});

test("concurrent consumption creates exactly one account/session and verifies an existing token once", async () => {
  const p = await pending();
  const responses = await Promise.all([verify(request(p)), verify(request(p))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 400]);
  assert.equal(await db.user.count({ where: { emailNormalized: p.email } }), 1);
  const fixture = await existing();
  await resend(request({ email: fixture.email }));
  const body = { email: fixture.email, challengeToken: link(fixture.email).searchParams.get("token")! };
  assert.deepEqual((await Promise.all([verify(request(body)), verify(request(body))])).map(r => r.status).sort(), [200, 400]);
});

test("concurrent resends leave one usable token; resend racing completion leaves coherent state", async () => {
  const p = await pending();
  await Promise.all([resend(request({ email: p.email })), resend(request({ email: p.email }))]);
  const active = await db.emailChallenge.findMany({ where: { emailNormalized: p.email, consumedAt: null } });
  assert.equal(active.length, 1);
  const token = mail.filter(m => m.to.includes(p.email)).map(m => new URL(m.html.match(/href="([^"]+)"/)![1]).searchParams.get("token")!).find(t => digestSecurityToken(t, "email-register") === active[0].tokenHash)!;
  const [completion] = await Promise.all([verify(request({ ...p, challengeToken: token })), resend(request({ email: p.email }))]);
  const count = await db.user.count({ where: { emailNormalized: p.email } });
  assert.equal(count, completion.status === 201 ? 1 : 0);
  if (!count) assert.equal((await verify(request({ ...p, challengeToken: link(p.email).searchParams.get("token")! }))).status, 201);
});

test("transaction failures roll back account, verification and challenge rotation", async () => {
  const p = await pending();
  await assert.rejects(withVerificationTransaction(env, p.email, async s => {
    s.repositories.passwordCredentialRepository.createPasswordHash = async () => { throw new Error("injected write failure"); };
    return createEmailVerificationService({ ...s.repositories, clock: new SystemClock() }).completeRegistration({ ...p, requestId: prefix });
  }), /injected write failure/);
  assert.equal(await db.user.count({ where: { emailNormalized: p.email } }), 0);
  assert.equal((await challenge(p.challengeToken)).consumedAt, null);
  await assert.rejects(withVerificationTransaction(env, p.email, async s => {
    s.repositories.emailChallengeRepository.create = async () => { throw new Error("injected rotation failure"); };
    return s.registrationService.requestRegistration({ email: p.email, requestId: prefix });
  }), /injected rotation failure/);
  assert.equal((await challenge(p.challengeToken)).consumedAt, null);
});

test("Origin, CSRF and rate limits fail closed before token consumption; delivery failure can be retried", async () => {
  const p = await pending();
  const rejectedHeaders: Record<string, string>[] = [{ origin: "https://evil.example" }, { "x-csrf-token": "wrong" }, { "sec-fetch-site": "cross-site" }];
  for (const headers of rejectedHeaders) {
    assert.equal((await verify(request(p, headers))).status, 403);
  }
  allow = false;
  try { assert.equal((await verify(request(p))).status, 429); assert.equal((await resend(request({ email: p.email }))).status, 429); }
  finally { allow = true; }
  assert.equal((await challenge(p.challengeToken)).consumedAt, null);
  deliveryFails = true;
  try { assert.equal((await resend(request({ email: p.email }))).status, 200); }
  finally { deliveryFails = false; }
  assert.equal((await resend(request({ email: p.email }))).status, 200);
  assert.equal((await verify(request({ ...p, challengeToken: link(p.email).searchParams.get("token")! }))).status, 201);
});
