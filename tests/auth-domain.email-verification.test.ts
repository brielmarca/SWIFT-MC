import assert from "node:assert/strict";
import test from "node:test";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { createEmailVerificationService, type EmailVerificationDeps } from "@/lib/auth-domain/email-verification";
import {
  type UserRepository, type IdentityRepository, type PasswordCredentialRepository,
  type EmailChallengeRepository, type AuthUser, type AuthIdentity, type EmailChallenge, type EmailChallengePurpose,
  type AuthStatus, type AuthProvider,
} from "@/lib/auth-domain/repositories";
import type { AuthRole } from "@/lib/auth-domain/types";
import type { SessionService } from "@/lib/auth-domain/session-service";
import type { SessionValidateFailureCode } from "@/lib/auth-domain/types";
import type { AuthSession } from "@/lib/auth-domain/types";
import type { AuditRepository } from "@/lib/auth-domain/repositories";
import { Clock } from "@/lib/auth-domain/clock";
import type { PasswordResetDeps } from "@/lib/auth-domain/password-reset";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
  advance(ms: number) { this.nowValue = new Date(this.nowValue.getTime() + ms); }
}

class FakeUserRepository implements UserRepository {
  users = new Map<string, AuthUser>();
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
  async bumpAuthVersion(): Promise<boolean> {
    const u = this.users.values().next().value;
    if (u) { u.authVersion += 1; }
    return true;
  }
  async updateEmailVerifiedAt(userId: string, emailVerifiedAt: Date): Promise<void> {
    const u = this.users.get(userId);
    if (u) { u.emailVerifiedAt = emailVerifiedAt; }
  }
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
  async createPasswordHash(identityId: string, passwordHash: string): Promise<void> { this.creds.set(identityId, passwordHash); }
  async replacePasswordHashIfUnchanged(identityId: string, expectedPasswordHash: string, passwordHash: string): Promise<boolean> {
    if (this.creds.get(identityId) !== expectedPasswordHash) return false;
    this.creds.set(identityId, passwordHash);
    return true;
  }
  add(identityId: string, hash: string) { this.creds.set(identityId, hash); }
}

class FakeEmailChallengeRepository implements EmailChallengeRepository {
  clock: FixedClock;
  challenges = new Map<string, EmailChallenge>();
  constructor(clock?: FixedClock) { this.clock = clock ?? new FixedClock("2099-01-01T00:00:00Z"); }
  async create(params: {
    userId: string | null;
    emailNormalized: string;
    purpose: EmailChallengePurpose;
    tokenHash: string;
    authVersion: number | null;
    expiresAt: Date;
  }): Promise<EmailChallenge> {
    const record: EmailChallenge = {
      id: `ch_${this.challenges.size + 1}`,
      userId: params.userId,
      emailNormalized: params.emailNormalized,
      purpose: params.purpose,
      tokenHash: params.tokenHash,
      authVersion: params.authVersion,
      expiresAt: params.expiresAt,
      consumedAt: null,
      createdAt: this.clock.now(),
    };
    this.challenges.set(params.tokenHash, record);
    return record;
  }
  async consume(tokenHash: string): Promise<EmailChallenge | null> {
    const c = this.challenges.get(tokenHash);
    if (!c || c.consumedAt !== null || c.expiresAt < this.clock.now()) return null;
    c.consumedAt = this.clock.now();
    return c;
  }
  async expire(tokenHash: string): Promise<void> {
    const c = this.challenges.get(tokenHash);
    if (c && c.consumedAt === null) c.consumedAt = this.clock.now();
  }
  async invalidateOutstanding(emailNormalized: string, purpose: EmailChallengePurpose, exceptTokenHash?: string): Promise<void> {
    for (const c of this.challenges.values()) {
      if (c.emailNormalized === emailNormalized && c.purpose === purpose && c.consumedAt === null &&
          c.expiresAt > this.clock.now() && c.tokenHash !== exceptTokenHash) {
        c.consumedAt = this.clock.now();
      }
    }
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

function makeService(deps: Partial<EmailVerificationDeps> & { clock: FixedClock }) {
  return createEmailVerificationService({
    userRepository: deps.userRepository ?? new FakeUserRepository(),
    identityRepository: deps.identityRepository ?? new FakeIdentityRepository(),
    passwordCredentialRepository: deps.passwordCredentialRepository ?? new FakePasswordCredentialRepository(),
    emailChallengeRepository: deps.emailChallengeRepository ?? new FakeEmailChallengeRepository(deps.clock),
    auditRepository: deps.auditRepository ?? new FakeAuditRepository(),
    clock: deps.clock,
  } as EmailVerificationDeps);
}

// ---------------------------------------------------------------------------
// Successful email verification
// ---------------------------------------------------------------------------

test("complete registration with valid challenge creates account with emailVerifiedAt", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository(clock);
  const rawToken = generateSecurityToken("email-register");
  const tokenHash = digestSecurityToken(rawToken, "email-register");
  const expiresAt = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: null, emailNormalized: "a@example.com", purpose: "REGISTER",
    tokenHash, authVersion: null, expiresAt,
  });

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completeRegistration({
    email: "a@example.com", password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const user = await users.findById(result.userId);
  assert.ok(user);
  assert.equal(user.emailVerifiedAt !== null, true, "emailVerifiedAt must be set after verification");
  assert.equal(user.status, "ACTIVE");
  assert.equal(user.role, "USER");
  assert.equal(user.authVersion, 1);

  const identity = await identities.findByUserAndProvider(result.userId, "EMAIL_PASSWORD");
  assert.ok(identity);
  const credential = await creds.findByIdentity(identity!.id);
  assert.ok(credential);
  assert.notEqual(credential!.passwordHash, "SecurePass123!");
});

test("verification tokens cannot register or verify a different email", async () => {
  for (const action of ["completeRegistration", "verifyEmail"] as const) {
    const clock = new FixedClock("2026-10-22T00:00:00Z");
    const users = new FakeUserRepository();
    if (action === "verifyEmail") users.add(baseUser());
    const challenges = new FakeEmailChallengeRepository(clock);
    const token = generateSecurityToken("email-register");
    await challenges.create({ userId: null, emailNormalized: "attacker@example.com", purpose: "REGISTER", tokenHash: digestSecurityToken(token, "email-register"), authVersion: null, expiresAt: new Date("2099-01-01") });
    const svc = makeService({ clock, userRepository: users, emailChallengeRepository: challenges });
    await assert.rejects(svc[action]({ email: "a@example.com", password: "Strong-password123!", displayName: "Alice", challengeToken: token, requestId: "binding" }), /VERIFICATION_FAILED/);
    assert.equal((await users.findByNormalizedEmail("a@example.com"))?.emailVerifiedAt ?? null, null);
    assert.equal(users.users.size, action === "verifyEmail" ? 1 : 0);
  }
});

test("expired verification challenge is rejected", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const challenges = new FakeEmailChallengeRepository(clock);
  const rawToken = generateSecurityToken("email-register");
  const tokenHash = digestSecurityToken(rawToken, "email-register");
  const past = new Date("2026-01-01T00:00:00Z");
  challenges.create({
    userId: null, emailNormalized: "a@example.com", purpose: "REGISTER",
    tokenHash, authVersion: null, expiresAt: past,
  });
  clock.advance(1000); // move past expiry

  const svc = makeService({ clock, emailChallengeRepository: challenges });
  const result = await svc.completeRegistration({
    email: "a@example.com", password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_1",
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "VERIFICATION_FAILED");
});

test("consumed verification challenge cannot be replayed", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const challenges = new FakeEmailChallengeRepository(clock);
  const rawToken = generateSecurityToken("email-register");
  const tokenHash = digestSecurityToken(rawToken, "email-register");
  const future = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: null, emailNormalized: "a@example.com", purpose: "REGISTER",
    tokenHash, authVersion: null, expiresAt: future,
  });

  const svc = makeService({ clock, emailChallengeRepository: challenges });
  // First consumption succeeds.
  const first = await svc.completeRegistration({
    email: "a@example.com", password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_1",
  });
  assert.equal(first.ok, true);
  // Replay with same token fails.
  const replay = await svc.completeRegistration({
    email: "a@example.com", password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_2",
  });
  assert.equal(replay.ok, false);
  if (replay.ok) throw new Error("unreachable");
  assert.equal(replay.code, "VERIFICATION_FAILED");
});

test("wrong purpose challenge is rejected", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const challenges = new FakeEmailChallengeRepository(clock);
  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  const future = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: null, emailNormalized: "a@example.com", purpose: "PASSWORD_RESET",
    tokenHash, authVersion: null, expiresAt: future,
  });

  const svc = makeService({ clock, emailChallengeRepository: challenges });
  const result = await svc.completeRegistration({
    email: "a@example.com", password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_1",
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "VERIFICATION_FAILED");
});

test("registration when account already exists fails", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const challenges = new FakeEmailChallengeRepository(clock);
  const user = baseUser();
  users.add(user);
  const rawToken = generateSecurityToken("email-register");
  const tokenHash = digestSecurityToken(rawToken, "email-register");
  const future = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: null, emailNormalized: user.emailNormalized!, purpose: "REGISTER",
    tokenHash, authVersion: null, expiresAt: future,
  });

  const svc = makeService({ clock, userRepository: users, emailChallengeRepository: challenges });
  await assert.rejects(svc.completeRegistration({
    email: user.emailNormalized!, password: "SecurePass123!", displayName: "Alice",
    challengeToken: rawToken, requestId: "req_1",
  }), /VERIFICATION_FAILED/);
});

test("verifyEmail sets emailVerifiedAt on existing user", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const challenges = new FakeEmailChallengeRepository(clock);
  const user = baseUser({ emailVerifiedAt: null });
  users.add(user);
  const rawToken = generateSecurityToken("email-register");
  const tokenHash = digestSecurityToken(rawToken, "email-register");
  const future = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: user.id, emailNormalized: user.emailNormalized!, purpose: "REGISTER",
    tokenHash, authVersion: user.authVersion, expiresAt: future,
  });

  const svc = makeService({ clock, userRepository: users, emailChallengeRepository: challenges });
  const result = await svc.verifyEmail({
    email: user.emailNormalized!, challengeToken: rawToken, requestId: "req_1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const updated = await users.findById(user.id);
  assert.ok(updated!.emailVerifiedAt !== null, "emailVerifiedAt must be set");
});

// ---------------------------------------------------------------------------
// Password reset via email challenge
// ---------------------------------------------------------------------------

test("password reset consumes challenge and replaces hash atomically", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const users = new FakeUserRepository();
  const identities = new FakeIdentityRepository();
  const creds = new FakePasswordCredentialRepository();
  const challenges = new FakeEmailChallengeRepository(clock);
  const user = baseUser({ authVersion: 1 });
  users.add(user);
  const identity = { id: "id_1", userId: user.id, provider: "EMAIL_PASSWORD" as AuthProvider, providerSubject: user.emailNormalized!, createdAt: new Date(), lastAuthenticatedAt: null };
  identities.add(identity);
  creds.add(identity.id, "old-hash");

  const rawToken = generateSecurityToken("password-reset");
  const tokenHash = digestSecurityToken(rawToken, "password-reset");
  const future = new Date("2099-01-01T00:00:00Z");
  challenges.create({
    userId: user.id, emailNormalized: user.emailNormalized!, purpose: "PASSWORD_RESET",
    tokenHash, authVersion: 1, expiresAt: future,
  });

  // Use the password reset service directly for complete flow
  const { createPasswordResetService } = await import("@/lib/auth-domain/password-reset");
  class FakeSessionService {
    revokedUsers = new Set<string>();
    async revokeAllUserSessions(userId: string): Promise<void> { this.revokedUsers.add(userId); }
    async issueSession(): Promise<{ ok: true; session: AuthSession; rawToken: string }> { throw new Error("not used"); }
    async validateSession(): Promise<{ ok: true; session: AuthSession; user: AuthUser } | { ok: false; code: SessionValidateFailureCode }> { throw new Error("not used"); }
    async revokeSession(): Promise<void> {}
  }
  const svc = createPasswordResetService({
    userRepository: users,
    identityRepository: identities,
    passwordCredentialRepository: creds,
    emailChallengeRepository: challenges,
    sessionService: new FakeSessionService() as SessionService,
    auditRepository: new FakeAuditRepository(),
    clock,
  } as PasswordResetDeps);
  const result = await svc.completePasswordReset({
    email: user.emailNormalized!, challengeToken: rawToken, newPassword: "NewSecurePass123!", requestId: "req_1",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const updatedUser = await users.findById(user.id);
  assert.equal(updatedUser!.authVersion, 2, "authVersion must be incremented after reset");
  const updatedHash = creds.creds.get(identity.id);
  assert.notEqual(updatedHash, "old-hash");
  assert.notEqual(updatedHash, "NewSecurePass123!");
});
