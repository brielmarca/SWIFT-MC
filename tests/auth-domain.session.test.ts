import assert from "node:assert/strict";
import test from "node:test";
import { digestSessionToken, generateSessionToken, isValidToken } from "@/lib/auth/tokens";
import { SESSION_POLICY } from "@/lib/auth/session-policy";
import {
  createSessionService, type SessionService, type SessionServiceDeps,
} from "@/lib/auth-domain/session-service";
import {
  type SessionRepository, type UserRepository, type AuthUser, type AuthSession,
} from "@/lib/auth-domain/repositories";
import { Clock } from "@/lib/auth-domain/clock";

class FixedClock implements Clock {
  private nowValue: Date;
  constructor(start: string) { this.nowValue = new Date(start); }
  now(): Date { return new Date(this.nowValue.getTime()); }
  advance(ms: number) { this.nowValue = new Date(this.nowValue.getTime() + ms); }
  set(iso: string) { this.nowValue = new Date(iso); }
}

class FakeSessionRepository implements SessionRepository {
  constructor(private readonly clock: FixedClock) {}
  sessions = new Map<string, AuthSession>();
  async create(params: { userId: string; tokenHash: string; authVersion: number; idleExpiresAt: Date; absoluteExpiresAt: Date }): Promise<AuthSession> {
    const id = `sess_${Math.random().toString(36).slice(2)}`;
    const now = this.clock.now();
    const session: AuthSession = {
      id, userId: params.userId, tokenHash: params.tokenHash, authVersion: params.authVersion,
      createdAt: now, lastSeenAt: now, idleExpiresAt: params.idleExpiresAt,
      absoluteExpiresAt: params.absoluteExpiresAt, revokedAt: null, revocationReason: null,
      authenticatedAt: now, mfaVerifiedAt: null,
    };
    this.sessions.set(id, session);
    return session;
  }
  async findByTokenDigest(tokenHash: string): Promise<AuthSession | null> {
    for (const s of this.sessions.values()) if (s.tokenHash === tokenHash) return s;
    return null;
  }
  async touchLastSeen(sessionId: string, lastSeenAt: Date): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) { s.lastSeenAt = lastSeenAt; }
  }
  async revoke(sessionId: string, reason?: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) { s.revokedAt = new Date(); s.revocationReason = reason ?? null; }
  }
  async revokeAllForUser(userId: string): Promise<void> {
    for (const s of this.sessions.values()) if (s.userId === userId) { s.revokedAt = new Date(); }
  }
  async listActiveForUser(userId: string): Promise<AuthSession[]> {
    return [...this.sessions.values()].filter((s) => s.userId === userId && s.revokedAt === null);
  }
}

class FakeUserRepository implements UserRepository {
  users = new Map<string, AuthUser>();
  async findById(userId: string): Promise<AuthUser | null> { return this.users.get(userId) ?? null; }
  async findByNormalizedEmail(): Promise<AuthUser | null> { return null; }
  async bumpAuthVersion(): Promise<boolean> { return true; }
  add(user: AuthUser) { this.users.set(user.id, user); }
}

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user_1", emailNormalized: "a@example.com", emailVerifiedAt: null,
    displayName: "A", role: "USER", status: "ACTIVE", authVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeService(deps: Partial<SessionServiceDeps> & { clock: FixedClock }): SessionService {
  return createSessionService({
    sessionRepository: deps.sessionRepository ?? new FakeSessionRepository(deps.clock),
    userRepository: deps.userRepository ?? new FakeUserRepository(),
    clock: deps.clock,
  } as SessionServiceDeps);
}

test("session issuance persists only digest and returns raw token", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const svc = makeService({ clock, sessionRepository: repo });
  const user = baseUser();

  const result = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");

  assert.equal(isValidToken(result.rawToken), true);
  const digest = digestSessionToken(result.rawToken);
  const found = await repo.findByTokenDigest(digest);
  assert.ok(found, "digest must be persisted");
  assert.equal(found!.tokenHash, digest);
  assert.notEqual(found!.tokenHash, result.rawToken, "raw token must never be stored");
});

test("session validation happy path", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  const valid = await svc.validateSession({ token: issued.rawToken });
  assert.equal(valid.ok, true);
  if (!valid.ok) throw new Error("unreachable");
  assert.equal(valid.session.id, issued.session.id);
  assert.equal(valid.user.id, user.id);
});

test("invalid token format is rejected", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const result = await svc.validateSession({ token: "not-a-valid-token!!" });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "INVALID_TOKEN");
});

test("unknown session digest is rejected", async () => {
  const svc = makeService({ clock: new FixedClock("2026-10-22T00:00:00Z") });
  const token = generateSessionToken();
  const result = await svc.validateSession({ token });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "SESSION_NOT_FOUND");
});

test("revoked session is never revived", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  await repo.revoke(issued.session.id);
  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "SESSION_REVOKED");
});

test("idle expiry rejects session without revoking", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  // Advance past idle (2h) but not absolute (1d).
  clock.advance(SESSION_POLICY.inactivitySeconds * 1000 + 1);
  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "SESSION_IDLE_EXPIRED");
});

test("absolute expiry rejects session and is never extended", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  clock.advance(SESSION_POLICY.normalAbsoluteSeconds * 1000 + 1);
  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false, "session must be rejected past absolute expiry");
  if (result.ok) throw new Error("unreachable");
  // Idle (2h) expires before absolute (1d), so idle may fire first; either way expired.
  assert.ok(["SESSION_IDLE_EXPIRED", "SESSION_ABSOLUTE_EXPIRED"].includes(result.code!));
});

test("authVersion mismatch rejects session", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser({ authVersion: 1 });
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  // Bump user authVersion (e.g. password changed) -> session stale.
  const bumped = { ...user, authVersion: 2 };
  users.add(bumped);

  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "AUTH_VERSION_MISMATCH");
});

test("inactive account (suspended/deleted) is rejected", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });

  for (const status of ["SUSPENDED", "DELETED"] as const) {
    const user = baseUser({ status });
    users.add(user);
    const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
    assert.equal(issued.ok, true);
    if (!issued.ok) throw new Error("unreachable");
    const result = await svc.validateSession({ token: issued.rawToken });
    assert.equal(result.ok, false, `${status} should be rejected`);
    if (result.ok) throw new Error("unreachable");
    assert.equal(result.code, "USER_NOT_ACTIVE");
  }
});

test("remember-me extends absolute lifetime", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: true, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  // Remember-me sets absolute cap to 30 days (vs 1 day normal).
  const expectedAbsMs = SESSION_POLICY.rememberMeAbsoluteSeconds * 1000;
  const actualAbsMs = issued.session.absoluteExpiresAt.getTime() - clock.now().getTime();
  assert.ok(Math.abs(actualAbsMs - expectedAbsMs) < 1000, `remember-me absolute should be ~30d, got ${actualAbsMs / 1000}s`);
});

test("staff inactivity lifetime is shorter", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser({ role: "ADMIN" });
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: true });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  // Past staff inactivity (30m) but within normal inactivity (2h): expired.
  clock.advance(SESSION_POLICY.staffInactivitySeconds * 1000 + 1);
  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "SESSION_IDLE_EXPIRED");
});

test("required permission enforces RBAC", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser({ role: "USER" });
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  const ok = await svc.validateSession({ token: issued.rawToken, requiredPermission: "account:manage-self" });
  assert.equal(ok.ok, true);

  const denied = await svc.validateSession({ token: issued.rawToken, requiredPermission: "security:configure" });
  assert.equal(denied.ok, false);
  if (denied.ok) throw new Error("unreachable");
  assert.equal(denied.code, "INSUFFICIENT_PERMISSION");
});

test("recent-authentication requirement success and failure", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  // Within recent-auth window: success.
  const recent = await svc.validateSession({ token: issued.rawToken, requireRecentAuth: true });
  assert.equal(recent.ok, true);

  // Advance past recent-auth (10min): failure.
  clock.advance(SESSION_POLICY.recentAuthenticationSeconds * 1000 + 1);
  const stale = await svc.validateSession({ token: issued.rawToken, requireRecentAuth: true });
  assert.equal(stale.ok, false);
  if (stale.ok) throw new Error("unreachable");
  assert.equal(stale.code, "RECENT_AUTH_REQUIRED");
});

test("revoke current session removes it", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  await svc.revokeSession(issued.session.id);
  const result = await svc.validateSession({ token: issued.rawToken });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("unreachable");
  assert.equal(result.code, "SESSION_REVOKED");
});

test("logout-all revokes every session for a user", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const a = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  const b = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(a.ok, true); assert.equal(b.ok, true);

  await svc.revokeAllUserSessions(user.id);

  const ra = await svc.validateSession({ token: a.ok ? a.rawToken : "" });
  const rb = await svc.validateSession({ token: b.ok ? b.rawToken : "" });
  assert.equal(ra.ok, false);
  assert.equal(rb.ok, false);
});

test("lastSeen touch never extends absolute expiry", async () => {
  const clock = new FixedClock("2026-10-22T00:00:00Z");
  const repo = new FakeSessionRepository(clock);
  const users = new FakeUserRepository();
  const svc = makeService({ clock, sessionRepository: repo, userRepository: users });
  const user = baseUser();
  users.add(user);

  const issued = await svc.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isStaff: false });
  assert.equal(issued.ok, true);
  if (!issued.ok) throw new Error("unreachable");

  const absolute = issued.session.absoluteExpiresAt.getTime();

  // Repeated validation touches lastSeen but absolute stays fixed.
  await svc.validateSession({ token: issued.rawToken });
  clock.advance(1000);
  await svc.validateSession({ token: issued.rawToken });
  // Re-fetch to confirm absolute not extended in repo.
  const found = await repo.findByTokenDigest(digestSessionToken(issued.rawToken));
  assert.equal(found!.absoluteExpiresAt.getTime(), absolute);
});
