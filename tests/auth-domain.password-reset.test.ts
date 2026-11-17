import assert from "node:assert/strict";
import test from "node:test";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { createPasswordResetService, type PasswordResetDeps } from "@/lib/auth-domain/password-reset";
import {
  type UserRepository, type IdentityRepository, type PasswordCredentialRepository,
  type EmailChallengeRepository, type AuthUser, type AuthIdentity, type EmailChallenge, type EmailChallengePurpose,
  type AuthSession, type AuthRole, type AuthStatus, type AuthProvider,
} from "@/lib/auth-domain/repositories";
import type { SessionService } from "@/lib/auth-domain/session-service";
import type { SessionValidateFailureCode } from "@/lib/auth-domain/types";
import type { AuditRepository } from "@/lib/auth-domain/repositories";
import { RollbackRequiredError } from "@/lib/auth-domain/errors";
import { Clock } from "@/lib/auth-domain/clock";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
  advance(ms: number) { this.nowValue = new Date(this.nowValue.getTime() + ms); }
}

class FakeUserRepository implements UserRepository {
  users = new Map<string, AuthUser>();
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
    const user: AuthUser = { id, ...params, phoneE164: null, emailVerifiedAt: params.emailVerifiedAt ?? null };
    this.users.set(id, user);
    return user;
  }
  async bumpAuthVersion(userId: string, expected: number): Promise<boolean> {
    if (this.bumpShouldFail) return false;
    const u = this.users.get(userId);
    if (!u || u.authVersion !== expected) return false;
    u.authVersion += 1;
    return true;
  }
  async updateEmailVerifiedAt(): Promise<void> {}
  async updateProfile(userId: string, data: { displayName: string; phoneE164: string | null }): Promise<AuthUser> {
    const u = this.users.get(userId); if (!u) throw new Error("missing"); u.displayName = data.displayName; u.phoneE164 = data.phoneE164; return u;
  }
  async updateEmail(userId: string, emailNormalized: string, emailVerifiedAt: Date): Promise<AuthUser> {
    const u = this.users.get(userId); if (!u) throw new Error("missing"); u.emailNormalized = emailNormalized; u.emailVerifiedAt = emailVerifiedAt; return u;
  }
  add(u: AuthUser) { this.users.set(u.id, u); }
}

class FakeIdentityRepository implements IdentityRepository {
  identities = new Map<string, AuthIdentity>();
  async findByUserAndProvider(userId: string, provider: AuthProvider): Promise<AuthIdentity | null> {
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
  async deleteByUserAndProvider(userId: string, provider: AuthProvider): Promise<void> {
    for (const [id,i] of this.identities) if (i.userId===userId && i.provider===provider) this.identities.delete(id);
  }
  async updateProviderSubject(userId: string, provider: AuthProvider, providerSubject: string): Promise<void> {
    for (const i of this.identities.values()) if (i.userId===userId && i.provider===provider) i.providerSubject = providerSubject;
  }
  add(i: AuthIdentity) { this.identities.set(i.id, i); }
}

class FakePasswordCredentialRepository implements PasswordCredentialRepository {
  creds = new Map<string, string>();
  async findByIdentity(identityId: string): Promise<{ identityId: string; passwordHash: string; changedAt: Date } | null> {
    const h = this.creds.get(identityId);
    return h ? { identityId, passwordHash: h, changedAt: new Date() } : null;
  }
  async createPasswordHash(): Promise<void> {}
  async replacePasswordHashIfUnchanged(identityId: string, expectedPasswordHash: string, passwordHash: string): Promise<boolean> {
    const current = this.creds.get(identityId);
    if (current !== expectedPasswordHash) return false;
    this.creds.set(identityId, passwordHash);
    return true;
  }
  add(identityId: string, hash: string) { this.creds.set(identityId, hash); }
  getHash(identityId: string) { return this.creds.get(identityId); }
}

class FakeEmailChallengeRepository implements EmailChallengeRepository {
  clock: FixedClock;
  constructor(clock?: FixedClock) { this.clock = clock ?? new FixedClock("2099-01-01T00:00:00Z"); }
  challenges = new Map<string, EmailChallenge>();
  async create(): Promise<EmailChallenge> {
    return { id: "", userId: null, emailNormalized: "", purpose: "PASSWORD_RESET" as const, tokenHash: "", authVersion: null, expiresAt: new Date(), consumedAt: null, createdAt: new Date() };
  }
  async consume(tokenHash: string): Promise<EmailChallenge | null> {
    const c = this.challenges.get(tokenHash);
    if (!c || c.consumedAt !== null || c.expiresAt < this.clock.now()) return null;
    c.consumedAt = this.clock.now();
    return c;
  }
  async expire(): Promise<void> {}
  async invalidateOutstanding(): Promise<void> {}
  add(tokenHash: string, purpose: EmailChallengePurpose, expiresAt: Date, emailNormalized: string) {
    this.challenges.set(tokenHash, {
      id: tokenHash, userId: "user_1", emailNormalized, purpose, tokenHash,
      authVersion: 1, expiresAt, consumedAt: null, createdAt: new Date(),
    });
  }
}

class FakeAuditRepository implements AuditRepository {
  events: Array<{ eventType: string; outcome: string }> = [];
  async append(record: { eventType: string; outcome: string; requestId: string; metadata: Record<string, unknown>; actorUserId: string | null; subjectUserId: string | null }): Promise<void> {
    this.events.push({ eventType: record.eventType, outcome: record.outcome });
  }
}

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "user_1", emailNormalized: "a@example.com", emailVerifiedAt: null, displayName: "A", role: "USER", status: "ACTIVE", phoneE164: null, authVersion: 1, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

class FakeSessionService implements SessionService {
  revokedUsers = new Set<string>();
  async issueSession(): Promise<{ ok: true; session: AuthSession; rawToken: string }> { throw new Error("not used"); }
  async validateSession(): Promise<{ ok: true; session: AuthSession; user: AuthUser } | { ok: false; code: SessionValidateFailureCode }> { throw new Error("not used"); }
  async revokeSession(sessionId: string): Promise<void> { void sessionId; }
  async revokeAllUserSessions(userId: string): Promise<void> { this.revokedUsers.add(userId); }
}

function makeService(deps: Partial<PasswordResetDeps> & { clock: FixedClock }) {
  return createPasswordResetService({
    userRepository: deps.userRepository ?? new FakeUserRepository(),
    identityRepository: deps.identityRepository ?? new FakeIdentityRepository(),
    passwordCredentialRepository: deps.passwordCredentialRepository ?? new FakePasswordCredentialRepository(),
    emailChallengeRepository: deps.emailChallengeRepository ?? new FakeEmailChallengeRepository(deps.clock),
    sessionService: deps.sessionService ?? new FakeSessionService(),
    auditRepository: deps.auditRepository ?? new FakeAuditRepository(),
    clock: deps.clock,
  } as PasswordResetDeps);
}

test("expired challenge is rejected", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository();
  const user = baseUser();
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  creds.add(identity.id, "hash");

  const past = new Date("2026-01-01T00:00:00Z");
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  challenges.add(tokenHash, "PASSWORD_RESET", past, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_1" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "RESET_FAILED");
});

test("consumed challenge cannot be replayed", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository();
  const user = baseUser();
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  creds.add(identity.id, "hash");

  const future = new Date("2099-01-01T00:00:00Z");
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  challenges.add(tokenHash, "PASSWORD_RESET", future, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const first = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_first" });
  assert.equal(first.ok, true);
  const firstHash = creds.getHash(identity.id);
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_1" });
  assert.equal(creds.getHash(identity.id), firstHash);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "RESET_FAILED");
});

test("authVersion mismatch during reset is rejected", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository();
  const user = baseUser({ authVersion: 1 });
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  creds.add(identity.id, "hash");

  const future = new Date("2099-01-01T00:00:00Z");
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  challenges.add(tokenHash, "PASSWORD_RESET", future, user.emailNormalized!);

  // Simulate a concurrent authVersion bump: optimistic concurrency fails after
  // the challenge was consumed, so the flow must throw to roll the partial
  // mutation back instead of returning a failure object.
  users.bumpShouldFail = true;

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  await assert.rejects(
    () => svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_1" }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "RESET_FAILED" && error.reason === "AUTH_VERSION_MISMATCH",
    "post-consume failure must reject so the transaction rolls back, never report success",
  );
});

test("reset increments authVersion on success", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository();
  const user = baseUser({ authVersion: 1 });
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as const, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  creds.add(identity.id, "hash");

  const future = new Date("2099-01-01T00:00:00Z");
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  challenges.add(tokenHash, "PASSWORD_RESET", future, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const updated = await users.findById(user.id);
  assert.equal(updated!.authVersion, 2);
});

test("unknown email in reset produces generic failure", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const rawToken = generateSecurityToken("password-reset");
  const result = await svc.completePasswordReset({ email: "none@example.com", challengeToken: rawToken, newPassword: "new-secure-pass-123", requestId: "req_1" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "RESET_FAILED");
});

test("requestPasswordReset never discloses account existence", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const a = await svc.requestPasswordReset({ email: "exists@example.com", requestId: "r1" });
  const b = await svc.requestPasswordReset({ email: "ghost@example.com", requestId: "r2" });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(a.acknowledgement, b.acknowledgement);
});

test("reset token cannot target another email/user or outlive its auth version", async () => {
  for (const override of [
    { emailNormalized: "attacker@example.com" }, { userId: "attacker" }, { authVersion: 0 }, { authVersion: null },
  ]) {
    const clock = new FixedClock("2026-10-22T00:00:00Z");
    const users = new FakeUserRepository();
    const identities = new FakeIdentityRepository();
    const creds = new FakePasswordCredentialRepository();
    const challenges = new FakeEmailChallengeRepository(clock);
    const user = baseUser();
    users.add(user);
    identities.add({ id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: user.emailNormalized!, createdAt: clock.now(), lastAuthenticatedAt: null });
    creds.add("id_1", "original-hash");
    const rawToken = generateSecurityToken("password-reset");
    const tokenHash = digestSecurityToken(rawToken, "password-reset");
    challenges.add(tokenHash, "PASSWORD_RESET", new Date("2099-01-01"), user.emailNormalized!);
    Object.assign(challenges.challenges.get(tokenHash)!, override);
    const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
    await assert.rejects(
      () => svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-456", requestId: "binding" }),
      (error: unknown) => error instanceof RollbackRequiredError && error.code === "RESET_FAILED",
      "binding mismatch after challenge consumption must reject, never return ok:false",
    );
    assert.equal(creds.getHash("id_1"), "original-hash", "credential untouched");
    assert.equal(user.authVersion, 1, "authVersion untouched");
  }
});

test("reset never overwrites a concurrently replaced credential", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository(clock);
  const user = baseUser();
  users.add(user);
  identities.add({ id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: user.emailNormalized!, createdAt: clock.now(), lastAuthenticatedAt: null });
  creds.add("id_1", "original-hash");
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  challenges.add(tokenHash, "PASSWORD_RESET", new Date("2099-01-01T00:00:00Z"), user.emailNormalized!);

  // Simulate a concurrent writer landing between this request's credential read
  // and its conditional replace.
  const originalFind = creds.findByIdentity.bind(creds);
  creds.findByIdentity = async (identityId: string) => {
    const credential = await originalFind(identityId);
    creds.creds.set(identityId, "concurrent-writer-hash");
    return credential;
  };

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  await assert.rejects(
    () => svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: rawToken, newPassword: "new-secure-pass-456", requestId: "req_race" }),
    (error: unknown) => error instanceof RollbackRequiredError && error.code === "RESET_FAILED" && error.reason === "CREDENTIAL_MODIFIED",
    "lost conditional replace must reject so the consumed challenge rolls back",
  );
  assert.equal(creds.getHash("id_1"), "concurrent-writer-hash", "stale reset must not overwrite the concurrent password");
  assert.equal(user.authVersion, 1, "no authVersion bump after lost race");
});
