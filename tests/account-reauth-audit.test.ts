import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword } from "@/lib/auth/password";
import { verifySensitiveReauth } from "@/lib/auth/reauth";
import { createEmailChangeService } from "@/lib/auth-domain/email-change";
import type { EmailChallenge, EmailChallengeRepository } from "@/lib/auth-domain/repositories";
import type { SessionService } from "@/lib/auth-domain/session-service";

class FixedClock { now() { return new Date("2026-11-11T12:00:00Z"); } }

function fakePrisma(params: { hasPassword: boolean; passwordHash?: string }) {
  return {
    authIdentity: { findFirst: async () => params.hasPassword ? { id: "pwd-id" } : null },
    passwordCredential: { findUnique: async () => params.passwordHash ? { passwordHash: params.passwordHash } : null },
  } as unknown as import("@prisma/client").PrismaClient;
}

test("sensitive reauth allows recent session for Discord-only/passwordless users", async () => {
  const res = await verifySensitiveReauth({
    prisma: fakePrisma({ hasPassword: false }),
    userId: "u1",
    sessionAuthenticatedAt: new Date(Date.now() - 60_000),
    recentAuthWindowMs: 10 * 60_000,
  });
  assert.deepEqual(res, { ok: true, method: "recent_session" });
});

test("sensitive reauth rejects stale session for Discord-only users", async () => {
  const res = await verifySensitiveReauth({
    prisma: fakePrisma({ hasPassword: false }),
    userId: "u1",
    sessionAuthenticatedAt: new Date(Date.now() - 11 * 60_000),
    recentAuthWindowMs: 10 * 60_000,
  });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, "RECENT_AUTH_REQUIRED");
});

test("sensitive reauth requires valid password when password identity exists", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  const ok = await verifySensitiveReauth({
    prisma: fakePrisma({ hasPassword: true, passwordHash: hash }),
    userId: "u1",
    password: "correct-horse-battery-staple",
    recentAuthWindowMs: 10 * 60_000,
  });
  assert.deepEqual(ok, { ok: true, method: "password" });
  const bad = await verifySensitiveReauth({
    prisma: fakePrisma({ hasPassword: true, passwordHash: hash }),
    userId: "u1",
    password: "wrong",
    recentAuthWindowMs: 10 * 60_000,
  });
  assert.equal(bad.ok, false);
});

test("email change allows Discord-only recent reauth without password", async () => {
  const user = { id: "u1", emailNormalized: "old@example.com", displayName: "U", phoneE164: null, role: "USER" as const, status: "ACTIVE" as const, authVersion: 1, emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
  const challenges: Array<{ purpose: string }> = [];
  const challengeRepo: EmailChallengeRepository = {
    create: async (p) => { challenges.push({ purpose: p.purpose }); return { id: "c1", consumedAt: null, createdAt: new Date(), ...p } as EmailChallenge; },
    consume: async () => null,
    expire: async () => {},
    invalidateOutstanding: async () => {},
  };
  const svc = createEmailChangeService({
    userRepository: {
      findById: async () => user,
      findByNormalizedEmail: async () => null,
      createUser: async () => user,
      bumpAuthVersion: async () => true,
      updateEmailVerifiedAt: async () => {},
      updateProfile: async () => user,
      updateEmail: async () => user,
    },
    identityRepository: {
      findByProviderAndSubject: async () => null,
      findByUserAndProvider: async (_id, provider) => provider === "DISCORD" ? { id: "disc", userId: "u1", provider: "DISCORD", providerSubject: "d1", createdAt: new Date(), lastAuthenticatedAt: null } : null,
      resolveOwner: async () => null,
      createIdentity: async () => { throw new Error("no"); },
      deleteByUserAndProvider: async () => {},
      updateProviderSubject: async () => {},
    },
    passwordCredentialRepository: { findByIdentity: async () => null, createPasswordHash: async () => {}, replacePasswordHashIfUnchanged: async () => false },
    emailChallengeRepository: challengeRepo,
    sessionRepository: { create: async () => ({} as Awaited<ReturnType<SessionService["issueSession"]>> extends { session: infer S } ? S : never), findByTokenDigest: async () => null, touchLastSeen: async () => {}, revoke: async () => {}, revokeAllForUser: async () => {}, listActiveForUser: async () => [] } as unknown as import("@/lib/auth-domain/repositories").SessionRepository,
    auditRepository: { append: async () => {} },
    clock: new FixedClock(),
  });
  const res = await svc.requestEmailChange({ userId: "u1", newEmail: "new@example.com", recentAuthOk: true, requestId: "r1" });
  assert.equal(res.ok, true);
  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].purpose, "CHANGE_EMAIL");
});

test("Discord-only account without email can request first verified email", async () => {
  const user = { id: "u1", emailNormalized: null, displayName: "U", phoneE164: null, role: "USER" as const, status: "ACTIVE" as const, authVersion: 1, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
  const challenges: Array<{ purpose: string }> = [];
  const challengeRepo: EmailChallengeRepository = {
    create: async (p) => { challenges.push({ purpose: p.purpose }); return { id: "c1", consumedAt: null, createdAt: new Date(), ...p } as EmailChallenge; },
    consume: async () => null,
    expire: async () => {},
    invalidateOutstanding: async () => {},
  };
  const svc = createEmailChangeService({
    userRepository: {
      findById: async () => user,
      findByNormalizedEmail: async () => null,
      createUser: async () => user,
      bumpAuthVersion: async () => true,
      updateEmailVerifiedAt: async () => {},
      updateProfile: async () => user,
      updateEmail: async () => user,
    },
    identityRepository: {
      findByProviderAndSubject: async () => null,
      findByUserAndProvider: async (_id, provider) => provider === "DISCORD" ? { id: "disc", userId: "u1", provider: "DISCORD", providerSubject: "d1", createdAt: new Date(), lastAuthenticatedAt: null } : null,
      resolveOwner: async () => null,
      createIdentity: async () => { throw new Error("no"); },
      deleteByUserAndProvider: async () => {},
      updateProviderSubject: async () => {},
    },
    passwordCredentialRepository: { findByIdentity: async () => null, createPasswordHash: async () => {}, replacePasswordHashIfUnchanged: async () => false },
    emailChallengeRepository: challengeRepo,
    sessionRepository: { create: async () => ({} as Awaited<ReturnType<SessionService["issueSession"]>> extends { session: infer S } ? S : never), findByTokenDigest: async () => null, touchLastSeen: async () => {}, revoke: async () => {}, revokeAllForUser: async () => {}, listActiveForUser: async () => [] } as unknown as import("@/lib/auth-domain/repositories").SessionRepository,
    auditRepository: { append: async () => {} },
    clock: new FixedClock(),
  });
  const res = await svc.requestEmailChange({ userId: "u1", newEmail: "new@example.com", recentAuthOk: true, requestId: "r1" });
  assert.equal(res.ok, true);
  assert.equal(challenges.length, 1);
  assert.equal(challenges[0].purpose, "CHANGE_EMAIL");
});

test("email change rejects Discord-only request without recent auth or password", async () => {
  const user = { id: "u1", emailNormalized: "old@example.com", displayName: "U", phoneE164: null, role: "USER" as const, status: "ACTIVE" as const, authVersion: 1, emailVerifiedAt: new Date(), createdAt: new Date(), updatedAt: new Date() };
  const svc = createEmailChangeService({
    userRepository: { findById: async () => user, findByNormalizedEmail: async () => null, createUser: async () => user, bumpAuthVersion: async () => true, updateEmailVerifiedAt: async () => {}, updateProfile: async () => user, updateEmail: async () => user },
    identityRepository: { findByProviderAndSubject: async () => null, findByUserAndProvider: async () => null, resolveOwner: async () => null, createIdentity: async () => { throw new Error("no"); }, deleteByUserAndProvider: async () => {}, updateProviderSubject: async () => {} },
    passwordCredentialRepository: { findByIdentity: async () => null, createPasswordHash: async () => {}, replacePasswordHashIfUnchanged: async () => false },
    emailChallengeRepository: { create: async () => ({} as EmailChallenge), consume: async () => null, expire: async () => {}, invalidateOutstanding: async () => {} },
    sessionRepository: { create: async () => ({} as never), findByTokenDigest: async () => null, touchLastSeen: async () => {}, revoke: async () => {}, revokeAllForUser: async () => {}, listActiveForUser: async () => [] } as unknown as import("@/lib/auth-domain/repositories").SessionRepository,
    auditRepository: { append: async () => {} },
    clock: new FixedClock(),
  });
  const res = await svc.requestEmailChange({ userId: "u1", newEmail: "new@example.com", recentAuthOk: false, requestId: "r1" });
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.code, "RECENT_AUTH_REQUIRED");
});

test("Discord-only first email confirmation persists verified address without password identity", async () => {
  const user = { id: "u1", emailNormalized: null, displayName: "Discord User", phoneE164: null, role: "USER" as const, status: "ACTIVE" as const, authVersion: 1, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() };
  const verifiedEmail = "verified@example.com";
  const mutations: string[] = [];
  const challenge = {
    id: "challenge-1", userId: "u1", emailNormalized: verifiedEmail, purpose: "CHANGE_EMAIL" as const,
    authVersion: 1, tokenHash: "example-hash", expiresAt: new Date("2026-11-11T12:09:00Z"),
    consumedAt: null, createdAt: new Date("2026-11-11T12:00:00Z"),
  } as EmailChallenge;
  const svc = createEmailChangeService({
    userRepository: {
      findById: async () => user, findByNormalizedEmail: async () => null,
      createUser: async () => user, bumpAuthVersion: async () => true,
      updateEmailVerifiedAt: async () => {}, updateProfile: async () => user,
      updateEmail: async (_id, email, verifiedAt) => {
        assert.equal(email, verifiedEmail);
        assert.equal(verifiedAt.toISOString(), "2026-11-11T12:00:00.000Z");
        mutations.push("email");
        return user;
      },
    },
    identityRepository: {
      findByProviderAndSubject: async () => null,
      findByUserAndProvider: async () => null,
      resolveOwner: async () => null,
      createIdentity: async () => { throw new Error("must preserve Discord-only identity"); },
      deleteByUserAndProvider: async () => {},
      updateProviderSubject: async () => { throw new Error("cannot update nonexistent password identity"); },
    },
    passwordCredentialRepository: {
      findByIdentity: async () => null, createPasswordHash: async () => {},
      replacePasswordHashIfUnchanged: async () => false,
    },
    emailChallengeRepository: {
      create: async () => challenge, consume: async () => challenge,
      expire: async () => {}, invalidateOutstanding: async () => {},
    },
    sessionRepository: {
      create: async () => ({} as never), findByTokenDigest: async () => null,
      touchLastSeen: async () => {}, revoke: async () => {},
      revokeAllForUser: async () => { mutations.push("revoke"); },
      listActiveForUser: async () => [],
    } as unknown as import("@/lib/auth-domain/repositories").SessionRepository,
    auditRepository: { append: async () => {} },
    clock: new FixedClock(),
  });
  await assert.rejects(
    () => svc.confirmEmailChange({ userId: "another-user", email: verifiedEmail, challengeToken: "token", recentAuthOk: true, requestId: "r1" }),
    { name: "RollbackRequiredError" },
  );
  assert.deepEqual(mutations, [], "cross-user confirmation must not mutate any account");
  const result = await svc.confirmEmailChange({ userId: "u1", email: verifiedEmail, challengeToken: "token", recentAuthOk: true, requestId: "r2" });
  assert.deepEqual(result, { ok: true, userId: "u1" });
  assert.deepEqual(mutations, ["email", "revoke"]);
});

test("minecraft relink safety: bind logic rejects transfer to different owned UUID (source contract)", async () => {
  const src = await import("node:fs/promises").then(fs => fs.readFile("lib/minecraft-bridge/service.ts", "utf8"));
  assert.ok(src.includes("Para preservar seus benefícios, vincule novamente o mesmo UUID"), "must enforce same-UUID relink when entitlements owned");
  assert.ok(src.includes("Conta/UUID já vinculado; solicite desvinculação autenticada"), "must prevent hijack across accounts");
});

test("minecraft unlink must not revoke paid VIP entitlements", async () => {
  const src = await import("node:fs/promises").then(fs => fs.readFile("app/api/user/minecraft/unlink/route.ts", "utf8"));
  assert.ok(!src.includes('status: "REVOKED"'), "unlink route must not mark entitlements revoked");
  assert.ok(src.includes("minecraftUuid: null"), "unlink should detach delivery target, preserving ownership");
  assert.ok(src.includes("benefícios permanecem"), "user-facing safety message present");
});
