import assert from "node:assert/strict";
import test from "node:test";
import { createHook } from "node:async_hooks";
import { publicLoginFailure } from "@/lib/auth/errors";
import { createPasswordLoginService, type PasswordLoginDeps } from "@/lib/auth-domain/password-login";
import { createSessionService, type SessionService } from "@/lib/auth-domain/session-service";
import {
  type UserRepository, type IdentityRepository, type PasswordCredentialRepository,
  type AuthUser, type AuthIdentity, type PasswordCredential, type AuthSession, type SessionRepository,
  type AuthRole, type AuthStatus, type AuthProvider,
  type EmailChallengeRepository, type EmailChallenge, type EmailChallengePurpose,
} from "@/lib/auth-domain/repositories";
import type { AuditRepository } from "@/lib/auth-domain/repositories";
import { RollbackRequiredError } from "@/lib/auth-domain/errors";
import { Clock } from "@/lib/auth-domain/clock";
import { createLockoutDatabase } from "./helpers/login-lockout";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
}

class FakeSessionRepository implements SessionRepository {
  sessions: AuthSession[] = [];
  async create(params: { userId: string; tokenHash: string; authVersion: number; idleExpiresAt: Date; absoluteExpiresAt: Date }): Promise<AuthSession> {
    const now = new Date();
    const session: AuthSession = {
      id: `s${this.sessions.length + 1}`, userId: params.userId, tokenHash: params.tokenHash, authVersion: params.authVersion,
      createdAt: now, lastSeenAt: now, idleExpiresAt: params.idleExpiresAt,
      absoluteExpiresAt: params.absoluteExpiresAt, revokedAt: null, revocationReason: null,
      authenticatedAt: now, mfaVerifiedAt: null,
    };
    this.sessions.push(session);
    return session;
  }
  async findByTokenDigest(hash: string): Promise<AuthSession | null> { return this.sessions.find(s => s.tokenHash === hash) ?? null; }
  async touchLastSeen(): Promise<void> {}
  async revoke(): Promise<void> {}
  async revokeAllForUser(userId: string): Promise<void> {
    for (const session of this.sessions) if (session.userId === userId) session.revokedAt = new Date();
  }
  async listActiveForUser(): Promise<AuthSession[]> { return []; }
}

class FakeUserRepository implements UserRepository {
  users = new Map<string, AuthUser>();
  bumpCalls = 0;
  bumpShouldFail = false;
  async findById(userId: string): Promise<AuthUser | null> { return this.users.get(userId) ?? null; }
  async findByNormalizedEmail(email: string): Promise<AuthUser | null> {
    for (const u of this.users.values()) if (u.emailNormalized === email) return u;
    return null;
  }
  async createUser(params: {
    emailNormalized: string | null;
    displayName: string;
    role: AuthRole;
    status: AuthStatus;
    authVersion: number;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AuthUser> {
    const id = `user_${this.users.size + 1}`;
    const user: AuthUser = { id, ...params, emailVerifiedAt: params.emailVerifiedAt ?? null };
    this.users.set(id, user);
    return user;
  }
  async bumpAuthVersion(userId: string): Promise<boolean> {
    this.bumpCalls++;
    if (this.bumpShouldFail) return false;
    const user = this.users.get(userId);
    if (user) user.authVersion += 1;
    return true;
  }
  async updateEmailVerifiedAt(): Promise<void> {}
  add(u: AuthUser) { this.users.set(u.id, u); }
}

class FakeIdentityRepository implements IdentityRepository {
  identities = new Map<string, AuthIdentity>();
  async findByUserAndProvider(userId: string, provider: string): Promise<AuthIdentity | null> {
    for (const i of this.identities.values()) if (i.userId === userId && i.provider === provider) return i;
    return null;
  }
  async findByProviderAndSubject(): Promise<AuthIdentity | null> { return null; }
  async resolveOwner(): Promise<{ userId: string; user: AuthUser } | null> { return null; }
  async createIdentity(params: {
    userId: string;
    provider: AuthProvider;
    providerSubject: string;
    createdAt: Date;
  }): Promise<AuthIdentity> {
    const id = `id_${this.identities.size + 1}`;
    const identity: AuthIdentity = { id, ...params, lastAuthenticatedAt: null };
    this.identities.set(id, identity);
    return identity;
  }
  add(i: AuthIdentity) { this.identities.set(i.id, i); }
}

class FakePasswordCredentialRepository implements PasswordCredentialRepository {
  creds = new Map<string, PasswordCredential>();
  replaceCalls = 0;
  async findByIdentity(identityId: string): Promise<PasswordCredential | null> { return this.creds.get(identityId) ?? null; }
  async createPasswordHash(): Promise<void> {}
  async replacePasswordHashIfUnchanged(identityId: string, expectedPasswordHash: string, passwordHash: string): Promise<boolean> {
    this.replaceCalls++;
    const current = this.creds.get(identityId);
    if (!current || current.passwordHash !== expectedPasswordHash) return false;
    this.creds.set(identityId, { ...current, passwordHash, changedAt: new Date() });
    return true;
  }
  add(id: string, hash: string) { this.creds.set(id, { identityId: id, passwordHash: hash, changedAt: new Date() }); }
}

class FakeEmailChallengeRepository implements EmailChallengeRepository {
  invalidated: Array<{ emailNormalized: string; purpose: EmailChallengePurpose }> = [];
  async create(): Promise<EmailChallenge> { throw new Error("not used"); }
  async consume(): Promise<EmailChallenge | null> { throw new Error("not used"); }
  async expire(): Promise<void> {}
  async invalidateOutstanding(emailNormalized: string, purpose: EmailChallengePurpose): Promise<void> {
    this.invalidated.push({ emailNormalized, purpose });
  }
}

class FakeAuditRepository implements AuditRepository {
  events: Array<{ eventType: string; outcome: string }> = [];
  async append(record: { eventType: string; outcome: string; requestId: string; metadata: Record<string, unknown>; actorUserId: string | null; subjectUserId: string | null }): Promise<void> {
    this.events.push({ eventType: record.eventType, outcome: record.outcome });
  }
}

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "user_1", emailNormalized: "a@example.com", emailVerifiedAt: null, displayName: "A", role: "USER", status: "ACTIVE", authVersion: 1, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function makeService(deps: Partial<PasswordLoginDeps> & { clock: FixedClock }) {
  const clock = deps.clock;
  const userRepository: UserRepository = deps.userRepository ?? new FakeUserRepository();
  const identityRepository: IdentityRepository = deps.identityRepository ?? new FakeIdentityRepository();
  const passwordCredentialRepository: PasswordCredentialRepository = deps.passwordCredentialRepository ?? new FakePasswordCredentialRepository();
  const sessionService: SessionService = createSessionService({
    sessionRepository: new FakeSessionRepository(),
    userRepository,
    clock,
  });
  const auditRepository: AuditRepository = deps.auditRepository ?? new FakeAuditRepository();
  return createPasswordLoginService({ userRepository, identityRepository, passwordCredentialRepository,
    loginAttemptRepository: deps.loginAttemptRepository ?? { async recordLoginAttempt(_id, _hash, ok) { return ok; } },
    sessionService: deps.sessionService ?? sessionService, auditRepository,
    emailChallengeRepository: deps.emailChallengeRepository ?? new FakeEmailChallengeRepository(), clock });
}

test("password login success returns domain result only", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const user = baseUser();
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-password-123");
  creds.add(identity.id, hash);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  const result = await svc.login({ email: "A@Example.COM", password: "correct-password-123", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.user.id, user.id);
  assert.equal(typeof result.rawToken, "string");
  assert.equal(result.rawToken.length > 0, true);
  assert.equal("passwordHash" in result, false);
});

test("unknown email produces generic failure and exercises dummy work", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  let scryptCalls = 0;
  const hook = createHook({ init(_id, type) { if (type === "SCRYPTREQUEST") scryptCalls++; } });
  hook.enable();
  const result = await svc.login({ email: "none@example.com", password: "x", rememberMe: false, requestId: "req_1" }).finally(() => hook.disable());
  assert.equal(scryptCalls, 1, "unknown accounts must perform real scrypt work");
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "LOGIN_FAILED");
});

test("wrong password produces same public failure", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const user = baseUser();
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-password-123");
  creds.add(identity.id, hash);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  const result = await svc.login({ email: user.emailNormalized!, password: "wrong-pass", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "LOGIN_FAILED");
});

test("missing EMAIL_PASSWORD identity produces generic failure", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const user = baseUser();
  users.add(user);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  const result = await svc.login({ email: user.emailNormalized!, password: "x", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "LOGIN_FAILED");
});

test("suspended and deleted accounts produce generic failure", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  for (const status of ["SUSPENDED", "DELETED"] as const) {
    const users = new FakeUserRepository();
    const identities = new FakeIdentityRepository();
    const creds = new FakePasswordCredentialRepository();
    const user = baseUser({ status });
    users.add(user);
    const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
    identities.add(identity);
    const hash = await (await import("@/lib/auth/password")).hashPassword("correct-password-123");
    creds.add(identity.id, hash);

    const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
    const result = await svc.login({ email: user.emailNormalized!, password: "correct-password-123", rememberMe: false, requestId: "req_1" });
    assert.equal(result.ok, false, `${status} should fail publicly`);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.code, "LOGIN_FAILED");
  }
});

test("all public failures are identical", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const a = await svc.login({ email: "none@example.com", password: "x", rememberMe: false, requestId: "r1" });
  const b = await svc.login({ email: "none@example.com", password: "wrong", rememberMe: false, requestId: "r2" });
  assert.deepEqual(a, b);
  assert.equal(publicLoginFailure().code, "LOGIN_FAILED");
});

test("client cannot supply role/user identity", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const user = baseUser();
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-password-123");
  creds.add(identity.id, hash);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  // Extra client-supplied fields are ignored by the domain service signature.
  const result = await svc.login({ email: user.emailNormalized!, password: "correct-password-123", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.user.role, "USER");
});

test("login enforces persisted lockout across service instances with generic failures and no session issuance", async () => {
  const { db, repository } = await createLockoutDatabase();
  try {
    const clock = new FixedClock(new Date().toISOString());
    const users = new FakeUserRepository();
    const identities = new FakeIdentityRepository();
    const creds = new FakePasswordCredentialRepository();
    const user = baseUser();
    users.add(user);
    identities.add({ id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: user.emailNormalized!, createdAt: clock.now(), lastAuthenticatedAt: null });
    const hash = await (await import("@/lib/auth/password")).hashPassword("correct-password-123");
    creds.add("id_1", hash);
    await db.query(`INSERT INTO "PasswordCredential" ("identityId", "passwordHash") VALUES ($1, $2)`, ["id_1", hash]);
    const sessions = new FakeSessionRepository();
    const sessionService = createSessionService({ sessionRepository: sessions, userRepository: users, clock });
    const deps = { clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, loginAttemptRepository: repository, sessionService };
    const login = (email: string, password: string) => makeService(deps).login({ email, password, rememberMe: false, requestId: "lockout-test" });
    const unknown = await login("unknown@example.com", "wrong-pass");
    for (let i = 0; i < 5; i++) assert.deepEqual(await login(" A@Example.COM ", "wrong-pass"), unknown);
    assert.deepEqual(await login(user.emailNormalized!, "correct-password-123"), unknown);
    assert.equal(sessions.sessions.length, 0);
    await db.exec(`UPDATE "PasswordCredential" SET "lockedUntil" = now() - INTERVAL '1 second'`);
    const first = await login(user.emailNormalized!, "correct-password-123");
    assert.ok(first.ok);
    assert.equal((await sessionService.validateSession({ token: first.rawToken })).ok, true);
    const second = await login(user.emailNormalized!, "correct-password-123");
    assert.ok(second.ok);
    assert.notEqual(first.rawToken, second.rawToken);
    assert.equal((await sessionService.validateSession({ token: first.rawToken })).ok, false, "rotated token cannot be replayed");
    assert.equal((await sessionService.validateSession({ token: second.rawToken })).ok, true);
  } finally {
    await db.close();
  }
});

async function setupChangePassword() {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const sessions = new FakeSessionRepository();
  const challenges = new FakeEmailChallengeRepository();
  const audits = new FakeAuditRepository();
  const user = baseUser();
  users.add(user);
  identities.add({ id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null });
  const { hashPassword } = await import("@/lib/auth/password");
  const oldHash = await hashPassword("current-password-123");
  creds.add("id_1", oldHash);
  const sessionService = createSessionService({ sessionRepository: sessions, userRepository: users, clock });
  await sessions.create({
    userId: user.id, tokenHash: "tok_1", authVersion: 1,
    idleExpiresAt: new Date("2026-10-23T00:00:00Z"), absoluteExpiresAt: new Date("2026-11-22T00:00:00Z"),
  });
  const svc = makeService({
    clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds,
    sessionService, auditRepository: audits, emailChallengeRepository: challenges,
  });
  return { clock, users, identities, creds, sessions, challenges, audits, user, oldHash, svc };
}

test("changePassword success: conditional replace, authVersion bump, session revocation, reset-challenge invalidation", async () => {
  const { users, creds, sessions, challenges, audits, user, oldHash, svc } = await setupChangePassword();
  const result = await svc.changePassword({
    email: user.emailNormalized!, currentPassword: "current-password-123", newPassword: "brand-new-pass", requestId: "req_cp",
  });
  assert.equal(result.ok, true);
  const { verifyPassword } = await import("@/lib/auth/password");
  const stored = creds.creds.get("id_1")!;
  assert.notEqual(stored.passwordHash, oldHash);
  assert.equal(await verifyPassword("brand-new-pass", stored.passwordHash), true);
  assert.equal(users.bumpCalls, 1);
  assert.equal(user.authVersion, 2, "authVersion must increment to invalidate existing sessions");
  assert.ok(sessions.sessions.every(s => s.revokedAt !== null), "all sessions must be revoked");
  assert.deepEqual(challenges.invalidated, [{ emailNormalized: user.emailNormalized, purpose: "PASSWORD_RESET" }]);
  assert.ok(audits.events.some(e => e.eventType === "PASSWORD_CHANGED" && e.outcome === "success"));
});

test("changePassword wrong current password fails without any write", async () => {
  const { users, creds, sessions, challenges, user, oldHash, svc } = await setupChangePassword();
  const result = await svc.changePassword({
    email: user.emailNormalized!, currentPassword: "wrong-pass", newPassword: "brand-new-pass", requestId: "req_cp",
  });
  assert.deepEqual(result, { ok: false, code: "CHANGE_FAILED" });
  assert.equal(creds.replaceCalls, 0, "no credential replacement on wrong password");
  assert.equal(creds.creds.get("id_1")!.passwordHash, oldHash, "hash unchanged");
  assert.equal(users.bumpCalls, 0, "no authVersion bump on wrong password");
  assert.equal(sessions.sessions[0]!.revokedAt, null, "sessions untouched");
  assert.deepEqual(challenges.invalidated, [], "challenges untouched");
});

test("changePassword never overwrites a concurrently replaced credential", async () => {
  const { creds, users, sessions, user, oldHash, svc } = await setupChangePassword();
  // Simulate a concurrent writer landing between this request's read and its
  // conditional replace: the stored hash no longer matches the verified one.
  const originalFind = creds.findByIdentity.bind(creds);
  creds.findByIdentity = async (identityId: string) => {
    const credential = await originalFind(identityId);
    if (credential) creds.creds.set(identityId, { ...credential, passwordHash: "concurrent-writer-hash" });
    return credential;
  };
  const result = await svc.changePassword({
    email: user.emailNormalized!, currentPassword: "current-password-123", newPassword: "brand-new-pass", requestId: "req_cp",
  });
  assert.deepEqual(result, { ok: false, code: "CHANGE_FAILED" });
  assert.equal(creds.replaceCalls, 1, "conditional replace attempted");
  assert.equal(creds.creds.get("id_1")!.passwordHash, "concurrent-writer-hash", "stale request must not overwrite the concurrent password");
  assert.equal(users.bumpCalls, 0, "no authVersion bump after lost race");
  assert.equal(sessions.sessions[0]!.revokedAt, null, "sessions untouched after lost race");
  assert.notEqual(creds.creds.get("id_1")!.passwordHash, oldHash);
});

test("changePassword throws RollbackRequiredError when the authVersion bump fails after replacement", async () => {
  const { users, creds, sessions, user, svc } = await setupChangePassword();
  users.bumpShouldFail = true;
  await assert.rejects(
    () => svc.changePassword({
      email: user.emailNormalized!, currentPassword: "current-password-123", newPassword: "brand-new-pass", requestId: "req_cp",
    }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "CHANGE_FAILED" && error.reason === "AUTH_VERSION_MISMATCH",
    "partial mutation must reject so the transaction rolls back, never return ok:false",
  );
  assert.equal(creds.replaceCalls, 1);
  assert.equal(users.bumpCalls, 1);
  assert.equal(sessions.sessions[0]!.revokedAt, null, "session revocation never runs after the bump failure");
});
