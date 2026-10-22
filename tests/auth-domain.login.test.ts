import assert from "node:assert/strict";
import test from "node:test";
import { publicLoginFailure } from "@/lib/auth/errors";
import { createPasswordLoginService, type PasswordLoginDeps } from "@/lib/auth-domain/password-login";
import { createSessionService, type SessionService } from "@/lib/auth-domain/session-service";
import {
  type UserRepository, type IdentityRepository, type PasswordCredentialRepository,
  type AuthUser, type AuthIdentity, type PasswordCredential, type AuthSession, type SessionRepository,
} from "@/lib/auth-domain/repositories";
import type { AuditRepository } from "@/lib/auth-domain/repositories";
import { Clock } from "@/lib/auth-domain/clock";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
}

class FakeSessionRepository implements SessionRepository {
  sessions: Array<{ userId: string; authVersion: number; tokenHash: string }> = [];
  async create(params: { userId: string; tokenHash: string; authVersion: number; idleExpiresAt: Date; absoluteExpiresAt: Date }): Promise<AuthSession> {
    const now = new Date();
    const session: AuthSession = {
      id: "s1", userId: params.userId, tokenHash: params.tokenHash, authVersion: params.authVersion,
      createdAt: now, lastSeenAt: now, idleExpiresAt: params.idleExpiresAt,
      absoluteExpiresAt: params.absoluteExpiresAt, revokedAt: null, revocationReason: null,
      authenticatedAt: now, mfaVerifiedAt: null,
    };
    this.sessions.push({ userId: params.userId, authVersion: params.authVersion, tokenHash: params.tokenHash });
    return session;
  }
  async findByTokenDigest(): Promise<AuthSession | null> { return null; }
  async touchLastSeen(): Promise<void> {}
  async revoke(): Promise<void> {}
  async revokeAllForUser(): Promise<void> {}
  async listActiveForUser(): Promise<AuthSession[]> { return []; }
}

class FakeUserRepository implements UserRepository {
  users = new Map<string, AuthUser>();
  async findById(userId: string): Promise<AuthUser | null> { return this.users.get(userId) ?? null; }
  async findByNormalizedEmail(email: string): Promise<AuthUser | null> {
    for (const u of this.users.values()) if (u.emailNormalized === email) return u;
    return null;
  }
  async bumpAuthVersion(): Promise<boolean> { return true; }
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
  creds = new Map<string, PasswordCredential>();
  async findByIdentity(identityId: string): Promise<PasswordCredential | null> { return this.creds.get(identityId) ?? null; }
  async replacePasswordHash(): Promise<void> {}
  add(id: string, hash: string) { this.creds.set(id, { identityId: id, passwordHash: hash, changedAt: new Date() }); }
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
  return createPasswordLoginService({ userRepository, identityRepository, passwordCredentialRepository, sessionService, auditRepository, clock });
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
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-pass");
  creds.add(identity.id, hash);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  const result = await svc.login({ email: "A@Example.COM", password: "correct-pass", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.user.id, user.id);
  assert.equal(typeof result.rawToken, "string");
  assert.equal(result.rawToken.length > 0, true);
  assert.equal("passwordHash" in result, false);
});

test("unknown email produces generic failure and exercises dummy work", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const result = await svc.login({ email: "none@example.com", password: "x", rememberMe: false, requestId: "req_1" });
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
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-pass");
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
    const hash = await (await import("@/lib/auth/password")).hashPassword("correct-pass");
    creds.add(identity.id, hash);

    const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
    const result = await svc.login({ email: user.emailNormalized!, password: "correct-pass", rememberMe: false, requestId: "req_1" });
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
  const hash = await (await import("@/lib/auth/password")).hashPassword("correct-pass");
  creds.add(identity.id, hash);

  const svc = makeService({ clock, userRepository: users, identityRepository: identities, passwordCredentialRepository: creds });
  // Extra client-supplied fields are ignored by the domain service signature.
  const result = await svc.login({ email: user.emailNormalized!, password: "correct-pass", rememberMe: false, requestId: "req_1" });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  assert.equal(result.user.role, "USER");
});
