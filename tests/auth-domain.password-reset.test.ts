import assert from "node:assert/strict";
import test from "node:test";
import { createPasswordResetService, type PasswordResetDeps } from "@/lib/auth-domain/password-reset";
import {
  type UserRepository, type IdentityRepository, type PasswordCredentialRepository,
  type EmailChallengeRepository, type AuthUser, type AuthIdentity, type EmailChallenge, type EmailChallengePurpose,
} from "@/lib/auth-domain/repositories";
import type { AuditRepository } from "@/lib/auth-domain/repositories";
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
  async bumpAuthVersion(userId: string, expected: number): Promise<boolean> {
    if (this.bumpShouldFail) return false;
    const u = this.users.get(userId);
    if (!u || u.authVersion !== expected) return false;
    u.authVersion += 1;
    return true;
  }
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
  add(i: AuthIdentity) { this.identities.set(i.id, i); }
}

class FakePasswordCredentialRepository implements PasswordCredentialRepository {
  creds = new Map<string, string>();
  async findByIdentity(identityId: string): Promise<{ identityId: string; passwordHash: string; changedAt: Date } | null> {
    const h = this.creds.get(identityId);
    return h ? { identityId, passwordHash: h, changedAt: new Date() } : null;
  }
  async replacePasswordHash(identityId: string, passwordHash: string): Promise<void> { this.creds.set(identityId, passwordHash); }
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
      id: tokenHash, userId: null, emailNormalized, purpose, tokenHash,
      authVersion: null, expiresAt, consumedAt: null, createdAt: new Date(),
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
  return { id: "user_1", emailNormalized: "a@example.com", emailVerifiedAt: null, displayName: "A", role: "USER", status: "ACTIVE", authVersion: 1, createdAt: new Date(), updatedAt: new Date(), ...overrides };
}

function makeService(deps: Partial<PasswordResetDeps> & { clock: FixedClock }) {
  return createPasswordResetService({
    userRepository: deps.userRepository ?? new FakeUserRepository(),
    identityRepository: deps.identityRepository ?? new FakeIdentityRepository(),
    passwordCredentialRepository: deps.passwordCredentialRepository ?? new FakePasswordCredentialRepository(),
    emailChallengeRepository: deps.emailChallengeRepository ?? new FakeEmailChallengeRepository(deps.clock),
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
  challenges.add("tok_expired", "PASSWORD_RESET", past, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: "tok_expired", newPassword: "new-pass", requestId: "req_1" });
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
  challenges.add("tok_consumed", "PASSWORD_RESET", future, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  // First consume marks it consumed.
  await challenges.consume("tok_consumed");
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: "tok_consumed", newPassword: "new-pass", requestId: "req_1" });
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
  challenges.add("tok_ok", "PASSWORD_RESET", future, user.emailNormalized!);

  // Simulate a concurrent authVersion bump: optimistic concurrency fails.
  users.bumpShouldFail = true;

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: "tok_ok", newPassword: "new-pass", requestId: "req_1" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "RESET_FAILED");
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
  challenges.add("tok_ok", "PASSWORD_RESET", future, user.emailNormalized!);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds, emailChallengeRepository: challenges });
  const result = await svc.completePasswordReset({ email: user.emailNormalized!, challengeToken: "tok_ok", newPassword: "new-pass", requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  const updated = await users.findById(user.id);
  assert.equal(updated!.authVersion, 2);
});

test("unknown email in reset produces generic failure", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const result = await svc.completePasswordReset({ email: "none@example.com", challengeToken: "tok", newPassword: "new-pass", requestId: "req_1" });
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
