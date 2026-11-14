import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test, { after, mock } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createTestPrisma } from "./helpers";
import { buildAuthServices, withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { createEmailVerificationService } from "@/lib/auth-domain/email-verification";
import { SystemClock } from "@/lib/auth-domain/clock";
import { RollbackRequiredError } from "@/lib/auth-domain/errors";
import { verifyPassword } from "@/lib/auth/password";
import { digestSecurityToken } from "@/lib/auth/tokens";

const db = createTestPrisma()!;
const services = buildAuthServices(db);
const prefix = randomUUID();
const requestId = prefix;
const emails: string[] = [];
const password = "Database-Test-Password-123!";
const env = {
  APP_URL: "https://swift.example",
  AUTH_HYPERDRIVE: { connectionString: process.env.TEST_DATABASE_URL! },
  AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) },
};
// Only the Cloudflare environment/binding is substituted; session validation,
// Prisma, transactions, password hashing, CSRF and authorization remain real.
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
const { POST: passwordPOST } = await import("@/app/api/user/password/route");

after(async () => {
  try {
    const users = await db.user.findMany({ where: { emailNormalized: { in: emails } } });
    const ids = users.map((user) => user.id);
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
  return { email, challengeToken: result.challengeToken, password, displayName: "Atomicity", requestId };
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
  return { email: params.email, userId: result.userId };
}

async function login(email: string, candidate = password) {
  return withAuthTransaction(env, (s) => s.loginService.login({ email, password: candidate, rememberMe: false, requestId }));
}

async function credentialState(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const identity = await db.authIdentity.findFirstOrThrow({ where: { userId, provider: "EMAIL_PASSWORD" } });
  const credential = await db.passwordCredential.findUniqueOrThrow({ where: { identityId: identity.id } });
  return { authVersion: user.authVersion, passwordHash: credential.passwordHash };
}

function changePasswordRequest(sessionToken: string | null, currentPassword: string, newPassword: string, withCsrf = true) {
  const csrf = randomBytes(32).toString("base64url");
  const cookie = [
    ...(sessionToken ? [`__Host-swiftmc_session=${sessionToken}`] : []),
    `__Host-swiftmc_csrf=${csrf}`,
  ].join("; ");
  const headers: Record<string, string> = {
    cookie,
    "content-type": "application/json",
    origin: "https://swift.example",
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
  };
  if (withCsrf) headers["x-csrf-token"] = csrf;
  return new Request("https://swift.example/api/user/password", {
    method: "POST",
    headers,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

async function waitForUserUpdateWaiter(): Promise<number> {
  const deadline = Date.now() + 4000;
  let seen = 0;
  while (Date.now() < deadline) {
    const rows = await db.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM pg_stat_activity
      WHERE wait_event_type = 'Lock' AND datname = current_database() AND query LIKE 'UPDATE %"User"%'`;
    seen = rows[0]?.n ?? 0;
    if (seen > 0) return seen;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return seen;
}

test("changePassword success replaces the hash, bumps authVersion, revokes sessions and invalidates reset challenges", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const extra = await services.sessionService.issueSession({
    userId: user.userId, authVersion: 1, rememberMe: false, isStaff: false,
  });
  assert.ok(extra.ok);
  const resetRequest = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(resetRequest.challengeToken);

  const result = await withAuthTransaction(env, (s) => s.loginService.changePassword({
    email: user.email, currentPassword: password, newPassword: "Atomic-New-456!", requestId,
  }));
  assert.deepEqual(result, { ok: true });

  const state = await credentialState(user.userId);
  assert.equal(state.authVersion, 2, "authVersion bumped exactly once");
  assert.equal(await verifyPassword(password, state.passwordHash), false, "old hash gone");
  assert.equal(await verifyPassword("Atomic-New-456!", state.passwordHash), true, "new hash active");

  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, false, "pre-change session revoked");
  assert.equal((await services.sessionService.validateSession({ token: extra.rawToken })).ok, false, "all pre-change sessions revoked");

  const challenge = await db.emailChallenge.findUniqueOrThrow({
    where: { tokenHash: digestSecurityToken(resetRequest.challengeToken, "password-reset") },
  });
  assert.notEqual(challenge.consumedAt, null, "outstanding password-reset challenge invalidated");

  assert.equal((await login(user.email, password)).ok, false, "old password no longer authenticates");
  assert.equal((await login(user.email, "Atomic-New-456!")).ok, true, "new password authenticates");
});

test("completePasswordReset rolls back the consumed challenge when the conditional credential replacement is lost", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const before = await credentialState(user.userId);
  const resetRequest = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(resetRequest.challengeToken);
  const tokenHash = digestSecurityToken(resetRequest.challengeToken, "password-reset");

  await assert.rejects(
    withAuthTransaction(env, async (s) => {
      // Simulate a concurrent writer landing between the flow's credential read
      // and its conditional replace.
      s.repositories.passwordCredentialRepository.replacePasswordHashIfUnchanged = async () => false;
      return s.passwordResetService.completePasswordReset({
        email: user.email, challengeToken: resetRequest.challengeToken!, newPassword: "Lost-Race-789!", requestId,
      });
    }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "RESET_FAILED",
    "post-consume failure must reject so the transaction rolls back",
  );

  const after = await credentialState(user.userId);
  assert.deepEqual(after, before, "credential and authVersion unchanged");
  const challenge = await db.emailChallenge.findUniqueOrThrow({ where: { tokenHash } });
  assert.equal(challenge.consumedAt, null, "challenge consumption rolled back, token not burned");
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, true, "sessions untouched");
  assert.equal((await login(user.email)).ok, true, "old password still works after rollback");
});

test("changePassword rolls back the credential replacement when the authVersion bump fails", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const before = await credentialState(user.userId);

  await assert.rejects(
    withAuthTransaction(env, async (s) => {
      s.repositories.userRepository.bumpAuthVersion = async () => false;
      return s.loginService.changePassword({
        email: user.email, currentPassword: password, newPassword: "Bump-Rollback-1!", requestId,
      });
    }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "CHANGE_FAILED",
    "a failed authVersion bump must reject, never report success",
  );

  const after = await credentialState(user.userId);
  assert.equal(after.passwordHash, before.passwordHash, "replacement rolled back with the failed bump");
  assert.equal(after.authVersion, before.authVersion, "authVersion unchanged");
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, true, "sessions survive the rollback");
  assert.equal((await login(user.email)).ok, true, "old password still authenticates");
});

test("changePassword rolls back replacement and version bump when session revocation fails", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const before = await credentialState(user.userId);

  await assert.rejects(
    withAuthTransaction(env, async (s) => {
      s.sessionService.revokeAllUserSessions = async () => {
        throw new Error("injected session revocation failure");
      };
      return s.loginService.changePassword({
        email: user.email, currentPassword: password, newPassword: "Revoke-Rollback-1!", requestId,
      });
    }),
    /injected session revocation failure/,
    "the session failure must propagate instead of committing partial security state",
  );

  const after = await credentialState(user.userId);
  assert.equal(after.passwordHash, before.passwordHash, "replacement rolled back");
  assert.equal(after.authVersion, before.authVersion, "authVersion bump rolled back");
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, true, "sessions survive the rollback");
  assert.equal((await login(user.email)).ok, true, "old password still authenticates");
});

test("completePasswordReset rolls back the consumed challenge when the authVersion bump fails", async () => {
  const user = await account();
  const before = await credentialState(user.userId);
  const resetRequest = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(resetRequest.challengeToken);
  const tokenHash = digestSecurityToken(resetRequest.challengeToken, "password-reset");

  await assert.rejects(
    withAuthTransaction(env, async (s) => {
      s.repositories.userRepository.bumpAuthVersion = async () => false;
      return s.passwordResetService.completePasswordReset({
        email: user.email, challengeToken: resetRequest.challengeToken!, newPassword: "Reset-Bump-Rollback-1!", requestId,
      });
    }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "RESET_FAILED",
    "post-consume bump failure must reject, never report success",
  );

  const after = await credentialState(user.userId);
  assert.deepEqual(after, before, "credential and authVersion unchanged");
  const challenge = await db.emailChallenge.findUniqueOrThrow({ where: { tokenHash } });
  assert.equal(challenge.consumedAt, null, "challenge consumption rolled back, recovery still possible");
  assert.equal((await login(user.email)).ok, true, "old password still authenticates");
});

test("concurrent changePassword requests: exactly one wins and the stored hash is never a mix", async () => {
  const user = await account();
  const [alpha, beta] = await Promise.all([
    withAuthTransaction(env, (s) => s.loginService.changePassword({
      email: user.email, currentPassword: password, newPassword: "Race-Alpha-111!", requestId,
    })),
    withAuthTransaction(env, (s) => s.loginService.changePassword({
      email: user.email, currentPassword: password, newPassword: "Race-Beta-222!", requestId,
    })),
  ]);

  const winners = [alpha, beta].filter((result) => result.ok);
  assert.equal(winners.length, 1, "exactly one racing change succeeds");
  for (const result of [alpha, beta]) {
    if (!result.ok) assert.equal(result.code, "CHANGE_FAILED", "the loser fails generically");
  }

  const state = await credentialState(user.userId);
  assert.equal(state.authVersion, 2, "exactly one authVersion bump");
  const alphaStored = await verifyPassword("Race-Alpha-111!", state.passwordHash);
  const betaStored = await verifyPassword("Race-Beta-222!", state.passwordHash);
  assert.notEqual(alphaStored, betaStored, "exactly one candidate password is stored");
  assert.equal(alpha.ok ? alphaStored : betaStored, true, "the winner's password is the stored one");
  assert.equal(alpha.ok ? betaStored : alphaStored, false, "the loser never overwrites the winner");
  assert.equal(await verifyPassword(password, state.passwordHash), false, "original password replaced");
});

test("concurrent changePassword and password reset never both succeed", async () => {
  const user = await account();
  const resetRequest = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(resetRequest.challengeToken);
  const tokenHash = digestSecurityToken(resetRequest.challengeToken, "password-reset");

  const results = await Promise.allSettled([
    withAuthTransaction(env, (s) => s.loginService.changePassword({
      email: user.email, currentPassword: password, newPassword: "Winner-Change-111!", requestId,
    })),
    withAuthTransaction(env, (s) => s.passwordResetService.completePasswordReset({
      email: user.email, challengeToken: resetRequest.challengeToken!, newPassword: "Winner-Reset-222!", requestId,
    })),
  ]);
  const changeOk = results[0].status === "fulfilled" && results[0].value.ok;
  const resetOk = results[1].status === "fulfilled" && results[1].value.ok;
  assert.equal(changeOk && resetOk, false, "change and reset must never both succeed");

  const state = await credentialState(user.userId);
  const challenge = await db.emailChallenge.findUniqueOrThrow({ where: { tokenHash } });
  if (resetOk) {
    assert.equal(await verifyPassword("Winner-Reset-222!", state.passwordHash), true, "reset's password stored");
    assert.equal(state.authVersion, 2);
    assert.notEqual(challenge.consumedAt, null, "winning reset consumes its challenge");
  } else if (changeOk) {
    assert.equal(await verifyPassword("Winner-Change-111!", state.passwordHash), true, "change's password stored");
    assert.equal(state.authVersion, 2);
    assert.notEqual(challenge.consumedAt, null, "winning change invalidates outstanding reset challenges");
  } else {
    assert.equal(await verifyPassword(password, state.passwordHash), true, "clean safe failure preserves the original password");
    assert.equal(state.authVersion, 1, "clean safe failure preserves authVersion");
    assert.equal(challenge.consumedAt, null, "clean safe failure does not burn the challenge");
  }
});

test("POST /api/user/password enforces session and CSRF, delegates to the domain flow, and reports only committed success", async () => {
  const user = await account();
  const before = await credentialState(user.userId);

  assert.equal((await passwordPOST(changePasswordRequest(null, password, "Route-401-1!"))).status, 401, "unauthenticated requests are rejected");

  const session = await login(user.email);
  assert.ok(session.ok);
  assert.equal((await passwordPOST(changePasswordRequest(session.rawToken, password, "Route-403-1!", false))).status, 403, "authenticated requests still require the CSRF header");

  const wrong = await passwordPOST(changePasswordRequest(session.rawToken, "not-the-password", "Route-400-1!"));
  assert.equal(wrong.status, 400, "wrong current password never succeeds");
  assert.equal((await credentialState(user.userId)).passwordHash, before.passwordHash, "failed attempt changes nothing");

  const response = await passwordPOST(changePasswordRequest(session.rawToken, password, "Route-Committed-1!"));
  assert.equal(response.status, 200, "committed success reports 200");
  const body = (await response.json()) as { ok?: boolean; error?: { code: string } };
  assert.equal(body.ok, true);
  assert.equal(body.error, undefined);

  const after = await credentialState(user.userId);
  assert.equal(after.authVersion, 2);
  assert.equal(await verifyPassword("Route-Committed-1!", after.passwordHash), true, "the route mutated through the domain flow");
  assert.equal((await services.sessionService.validateSession({ token: session.rawToken })).ok, false, "route success revokes sessions");
  assert.equal((await login(user.email, password)).ok, false, "old password no longer authenticates");
  assert.equal((await login(user.email, "Route-Committed-1!")).ok, true, "new password authenticates");
});

test("POST /api/user/password never reports success when the transaction rolls back (concurrent authVersion bump)", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);
  const before = await credentialState(user.userId);
  const resetRequest = await services.passwordResetService.requestPasswordReset({ email: user.email, requestId });
  assert.ok(resetRequest.challengeToken);

  // A concurrent writer locks the user row, waits for the route to reach its
  // conditional authVersion update, then commits a bump of its own. The route's
  // update matches zero rows and the whole password change must roll back.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let signalLocked!: () => void;
  const locked = new Promise<void>((resolve) => { signalLocked = resolve; });
  const holder = db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.userId} FOR UPDATE`;
    signalLocked();
    await gate;
    await tx.$executeRaw`UPDATE "User" SET "authVersion" = "authVersion" + 1, "updatedAt" = now() WHERE id = ${user.userId}`;
  }, { timeout: 30_000 });
  await locked;

  const pending = passwordPOST(changePasswordRequest(session.rawToken, password, "Rolled-Back-1!"));
  const waiters = await waitForUserUpdateWaiter();
  release();
  const response = await pending;
  await holder;

  assert.ok(waiters > 0, "the route blocked on the conditional authVersion update");
  assert.notEqual(response.status, 200, "a rolled-back transaction must never report success");
  assert.equal(response.status, 400, "rollback surfaces as the generic client failure");
  const body = (await response.json()) as { ok?: boolean; error?: { code: string } };
  assert.equal(body.ok, undefined, "no success payload on rollback");
  assert.equal(body.error?.code, "REQUEST_FAILED");

  const after = await credentialState(user.userId);
  assert.equal(after.passwordHash, before.passwordHash, "credential replacement rolled back");
  assert.equal(after.authVersion, 2, "only the concurrent writer's bump persisted");
  const sessionRow = await db.session.findUniqueOrThrow({ where: { id: session.session.id } });
  assert.equal(sessionRow.revokedAt, null, "rollback never revoked sessions (authVersion moved only by the concurrent writer)");
  assert.equal(await verifyPassword(password, after.passwordHash), true, "old password still authenticates");
  const challenge = await db.emailChallenge.findUniqueOrThrow({
    where: { tokenHash: digestSecurityToken(resetRequest.challengeToken, "password-reset") },
  });
  assert.equal(challenge.consumedAt, null, "reset challenges untouched by the rollback");
});

test("concurrent POST /api/user/password requests: exactly one reports success", async () => {
  const user = await account();
  const session = await login(user.email);
  assert.ok(session.ok);

  const [first, second] = await Promise.all([
    passwordPOST(changePasswordRequest(session.rawToken, password, "Double-A-111!")),
    passwordPOST(changePasswordRequest(session.rawToken, password, "Double-B-222!")),
  ]);
  const statuses = [first.status, second.status];
  assert.equal(statuses.filter((status) => status === 200).length, 1, "exactly one concurrent change reports success");
  for (const status of statuses) {
    assert.ok(status === 200 || status === 400 || status === 401, `unexpected status ${status}`);
  }

  const state = await credentialState(user.userId);
  assert.equal(state.authVersion, 2, "exactly one authVersion bump");
  const firstStored = await verifyPassword("Double-A-111!", state.passwordHash);
  const secondStored = await verifyPassword("Double-B-222!", state.passwordHash);
  assert.notEqual(firstStored, secondStored, "exactly one candidate password is stored");
  assert.equal(first.status === 200 ? firstStored : secondStored, true, "the reporting winner's password is stored");
  assert.equal(first.status === 200 ? secondStored : firstStored, false, "the loser never overwrites the winner");
  assert.equal(await verifyPassword(password, state.passwordHash), false, "original password replaced");
});
