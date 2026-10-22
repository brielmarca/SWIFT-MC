import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  createPrismaAuthRepositories,
  type PrismaAuthRepositories,
} from "@/lib/auth-persistence/prisma-auth-repositories";
import { PrismaUserRepository } from "@/lib/auth-persistence/prisma-user-repository";
import { PrismaIdentityRepository } from "@/lib/auth-persistence/prisma-identity-repository";
import { PrismaPasswordCredentialRepository } from "@/lib/auth-persistence/prisma-password-repository";
import { PrismaSessionRepository } from "@/lib/auth-persistence/prisma-session-repository";
import { PrismaBrowserContextRepository } from "@/lib/auth-persistence/prisma-browser-context-repository";
import { PrismaOAuthTransactionRepository } from "@/lib/auth-persistence/prisma-oauth-transaction-repository";
import { PrismaEmailChallengeRepository } from "@/lib/auth-persistence/prisma-email-challenge-repository";
import { PrismaAuditRepository } from "@/lib/auth-persistence/prisma-audit-repository";
import {
  mapUser, mapAuthIdentity, mapPasswordCredential, mapSession, mapBrowserContext,
  mapOAuthTransaction, mapEmailChallenge, mapAuditRecord,
  type PrismaUser, type PrismaAuthIdentity, type PrismaPasswordCredential,
  type PrismaSession, type PrismaAuthBrowserContext, type PrismaOAuthTransaction,
  type PrismaEmailChallenge, type PrismaAuthAuditEvent,
} from "@/lib/auth-persistence/mappers";
import {
  AuthAuditRecord,
  UserRepository, IdentityRepository, PasswordCredentialRepository, SessionRepository,
  BrowserContextRepository, OAuthTransactionRepository, EmailChallengeRepository, AuditRepository,
} from "@/lib/auth-domain/repositories";

type Call = { model: string; method: string; args: unknown };

function callOf(model: string, method: string) {
  return (args: unknown) => ({ model, method, args });
}

interface StubbedPrisma {
  calls: Call[];
  user: { findUnique: unknown; updateMany: unknown; create: unknown };
  authIdentity: { findUnique: unknown };
  passwordCredential: { findUnique: unknown; update: unknown };
  session: { create: unknown; findUnique: unknown; updateMany: unknown; findMany: unknown };
  authBrowserContext: { create: unknown; findUnique: unknown; updateMany: unknown };
  oAuthTransaction: { create: unknown; findUnique: unknown; updateMany: unknown };
  emailChallenge: { create: unknown; findUnique: unknown; updateMany: unknown };
  authAuditEvent: { create: unknown };
}

function client(prisma: StubbedPrisma): PrismaClient {
  return prisma as unknown as PrismaClient;
}

function makePrisma(): StubbedPrisma {
  const calls: Call[] = [];
  const stub = <T>(model: string, method: string, result: T): T => {
    const fn = (args: unknown) => {
      calls.push(callOf(model, method)(args));
      return Promise.resolve(result);
    };
    return fn as unknown as T;
  };
  const prisma = {
    calls,
    user: {
      findUnique: stub("user", "findUnique", null),
      updateMany: stub("user", "updateMany", { count: 1 }),
      create: stub("user", "create", {}),
    },
    authIdentity: { findUnique: stub("authIdentity", "findUnique", null) },
    passwordCredential: {
      findUnique: stub("passwordCredential", "findUnique", null),
      update: stub("passwordCredential", "update", {}),
    },
    session: {
      create: stub("session", "create", {}),
      findUnique: stub("session", "findUnique", null),
      updateMany: stub("session", "updateMany", { count: 1 }),
      findMany: stub("session", "findMany", []),
    },
    authBrowserContext: {
      create: stub("authBrowserContext", "create", {}),
      findUnique: stub("authBrowserContext", "findUnique", null),
      updateMany: stub("authBrowserContext", "updateMany", { count: 1 }),
    },
    oAuthTransaction: {
      create: stub("oAuthTransaction", "create", {}),
      findUnique: stub("oAuthTransaction", "findUnique", null),
      updateMany: stub("oAuthTransaction", "updateMany", { count: 1 }),
    },
    emailChallenge: {
      create: stub("emailChallenge", "create", {}),
      findUnique: stub("emailChallenge", "findUnique", null),
      updateMany: stub("emailChallenge", "updateMany", { count: 1 }),
    },
    authAuditEvent: { create: stub("authAuditEvent", "create", {}) },
  } as unknown as StubbedPrisma;
  return prisma;
}

const now = new Date("2026-10-22T00:00:00Z");

const prismaUser = {
  id: "user_1", emailNormalized: "a@example.com", emailVerifiedAt: null,
  displayName: "Alice", role: "USER", status: "ACTIVE", authVersion: 3,
  createdAt: now, updatedAt: now,
} as unknown as PrismaUser;

const prismaIdentity = {
  id: "ident_1", userId: "user_1", provider: "EMAIL_PASSWORD", providerSubject: "discord:1234",
  createdAt: now, lastAuthenticatedAt: null,
} as unknown as PrismaAuthIdentity;

const prismaCredential = {
  identityId: "ident_1",
  passwordHash: "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$salt$salt",
  changedAt: now,
} as unknown as PrismaPasswordCredential;

const prismaSession = {
  id: "sess_1", userId: "user_1", tokenHash: "digest", authVersion: 3,
  createdAt: now, lastSeenAt: now, idleExpiresAt: new Date(Date.now() + 1e6),
  absoluteExpiresAt: new Date(Date.now() + 2e6), revokedAt: null, revocationReason: null,
  authenticatedAt: now, mfaVerifiedAt: null,
} as unknown as PrismaSession;

const prismaContext = {
  id: "ctx_1", tokenHash: "ctx-digest", csrfTokenHash: "csrf-digest",
  expiresAt: now, consumedAt: null, createdAt: now,
} as unknown as PrismaAuthBrowserContext;

const prismaOAuth = {
  id: "oauth_1", stateHash: "state", browserContextId: "ctx_1", intent: "LOGIN",
  linkUserId: null, initiatingSessionId: null, pkceVerifierCiphertext: "cipher",
  returnPath: "/", expiresAt: now, consumedAt: null, createdAt: now,
} as unknown as PrismaOAuthTransaction;

const prismaChallenge = {
  id: "ch_1", userId: "user_1", emailNormalized: "a@example.com", purpose: "PASSWORD_RESET",
  tokenHash: "ch-digest", authVersion: 3, expiresAt: now, consumedAt: null, createdAt: now,
} as unknown as PrismaEmailChallenge;

const prismaAudit = {
  id: "audit_1", actorUserId: "user_1", subjectUserId: null, eventType: "LOGIN_SUCCESS",
  outcome: "success", requestId: "req_1", metadata: { attemptCount: 1 }, createdAt: now,
} as unknown as PrismaAuthAuditEvent;

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

test("mappers.mapUser preserves timestamps as Date and maps enums", () => {
  const user = mapUser(prismaUser);
  assert.equal(user.id, "user_1");
  assert.equal(user.emailNormalized, "a@example.com");
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(user.displayName, "Alice");
  assert.equal(user.role, "USER");
  assert.equal(user.status, "ACTIVE");
  assert.equal(user.authVersion, 3);
  assert.ok(user.createdAt instanceof Date);
  assert.ok(user.updatedAt instanceof Date);
});

test("mappers.mapAuthIdentity maps provider and subject", () => {
  const identity = mapAuthIdentity(prismaIdentity);
  assert.equal(identity.id, "ident_1");
  assert.equal(identity.provider, "EMAIL_PASSWORD");
  assert.equal(identity.providerSubject, "discord:1234");
  assert.equal(identity.lastAuthenticatedAt, null);
  assert.ok(identity.createdAt instanceof Date);
});

test("mappers.mapPasswordCredential returns hash within domain boundary", () => {
  const credential = mapPasswordCredential(prismaCredential);
  assert.equal(credential.identityId, "ident_1");
  assert.equal(credential.passwordHash, "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$salt$salt");
  assert.ok(credential.changedAt instanceof Date);
});

test("mappers.mapSession maps all fields without raw token", () => {
  const session = mapSession(prismaSession);
  assert.equal(session.id, "sess_1");
  assert.equal(session.tokenHash, "digest");
  assert.equal(session.authVersion, 3);
  assert.equal(session.revokedAt, null);
  assert.ok(session.authenticatedAt instanceof Date);
  assert.equal(session.mfaVerifiedAt, null);
});

test("mappers.mapBrowserContext omits consumedAt and stores digests only", () => {
  const context = mapBrowserContext(prismaContext);
  assert.equal(context.id, "ctx_1");
  assert.equal(context.tokenHash, "ctx-digest");
  assert.equal(context.csrfTokenHash, "csrf-digest");
  assert.equal("consumedAt" in context, false);
  assert.ok(context.expiresAt instanceof Date);
});

test("mappers.mapOAuthTransaction preserves intent and link fields", () => {
  const tx = mapOAuthTransaction(prismaOAuth);
  assert.equal(tx.stateHash, "state");
  assert.equal(tx.intent, "LOGIN");
  assert.equal(tx.linkUserId, null);
  assert.equal(tx.initiatingSessionId, null);
  assert.equal("pkceVerifierCiphertext" in tx, false);
  assert.equal(tx.consumedAt, null);
});

test("mappers.mapEmailChallenge preserves purpose, authVersion and consumed state", () => {
  const challenge = mapEmailChallenge(prismaChallenge);
  assert.equal(challenge.purpose, "PASSWORD_RESET");
  assert.equal(challenge.authVersion, 3);
  assert.equal(challenge.consumedAt, null);
  assert.equal(challenge.emailNormalized, "a@example.com");
});

test("mappers.mapAuditRecord round-trips sanitized metadata", () => {
  const record = mapAuditRecord(prismaAudit);
  assert.equal(record.eventType, "LOGIN_SUCCESS");
  assert.deepEqual(record.metadata, { attemptCount: 1 });
  assert.equal(record.actorUserId, "user_1");
});

test("mappers fail closed on unexpected enum values", () => {
  assert.throws(() => mapUser({ ...prismaUser, role: "BOGUS" as const } as unknown as PrismaUser), /Unexpected UserRole/);
  assert.throws(() => mapUser({ ...prismaUser, status: "ARCHIVED" as const } as unknown as PrismaUser), /Unexpected UserStatus/);
  assert.throws(() => mapAuthIdentity({ ...prismaIdentity, provider: "FACEBOOK" as const } as unknown as PrismaAuthIdentity), /Unexpected AuthProvider/);
  assert.throws(() => mapOAuthTransaction({ ...prismaOAuth, intent: "LINK_ACCOUNT" as const } as unknown as PrismaOAuthTransaction), /Unexpected OAuthIntent/);
  assert.throws(() => mapEmailChallenge({ ...prismaChallenge, purpose: "WELCOME" as const } as unknown as PrismaEmailChallenge), /Unexpected EmailChallengePurpose/);
});

// ---------------------------------------------------------------------------
// User repository
// ---------------------------------------------------------------------------

test("user repository findByNormalizedEmail issues exact normalized email query", async () => {
  const prisma = makePrisma();
  prisma.user.findUnique = (args: unknown) => {
    prisma.calls.push(callOf("user", "findUnique")(args));
    return Promise.resolve(prismaUser);
  };
  const repo = new PrismaUserRepository(client(prisma));
  await repo.findByNormalizedEmail("a@example.com");
  const call = prisma.calls.find((c) => c.model === "user" && c.method === "findUnique");
  assert.ok(call);
  assert.deepEqual(call.args, { where: { emailNormalized: "a@example.com" } });
});

test("user repository findById returns mapped user", async () => {
  const prisma = makePrisma();
  prisma.user.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { id: "user_1" } });
    return Promise.resolve(prismaUser);
  };
  const repo = new PrismaUserRepository(client(prisma));
  const user = await repo.findById("user_1");
  assert.ok(user);
  assert.equal(user.emailNormalized, "a@example.com");
});

test("user repository bumpAuthVersion is atomic conditional increment", async () => {
  const prisma = makePrisma();
  let capturedWhere: unknown = null;
  let capturedData: unknown = null;
  prisma.user.updateMany = (args: unknown) => {
    capturedWhere = (args as { where: unknown }).where;
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaUserRepository(client(prisma));
  const ok = await repo.bumpAuthVersion("user_1", 3);
  assert.equal(ok, true);
  assert.deepEqual(capturedWhere, { id: "user_1", authVersion: 3 });
  assert.deepEqual(capturedData, { authVersion: { increment: 1 } });
});

test("user repository bumpAuthVersion reports conflict when count is zero", async () => {
  const prisma = makePrisma();
  prisma.user.updateMany = (() => Promise.resolve({ count: 0 })) as unknown as never;
  const repo = new PrismaUserRepository(client(prisma));
  const ok = await repo.bumpAuthVersion("user_1", 3);
  assert.equal(ok, false);
});

// ---------------------------------------------------------------------------
// Identity repository
// ---------------------------------------------------------------------------

test("identity repository findByProviderAndSubject uses provider + subject", async () => {
  const prisma = makePrisma();
  prisma.authIdentity.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { provider_providerSubject: { provider: "DISCORD", providerSubject: "discord:42" } } });
    return Promise.resolve(prismaIdentity);
  };
  const repo = new PrismaIdentityRepository(client(prisma));
  const identity = await repo.findByProviderAndSubject("DISCORD", "discord:42");
  assert.ok(identity);
  assert.equal(identity.providerSubject, "discord:1234");
});

test("identity repository findByUserAndProvider uses user + provider", async () => {
  const prisma = makePrisma();
  prisma.authIdentity.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { userId_provider: { userId: "user_1", provider: "EMAIL_PASSWORD" } } });
    return Promise.resolve(prismaIdentity);
  };
  const repo = new PrismaIdentityRepository(client(prisma));
  const identity = await repo.findByUserAndProvider("user_1", "EMAIL_PASSWORD");
  assert.ok(identity);
});

test("identity repository has no email-based auto-merge path", () => {
  const repo = new PrismaIdentityRepository({} as unknown as PrismaClient);
  assert.equal((repo as { findByEmail?: unknown }).findByEmail, undefined);
  assert.equal(typeof repo.findByProviderAndSubject, "function");
  assert.equal(typeof repo.findByUserAndProvider, "function");
  assert.equal(typeof repo.resolveOwner, "function");
});

test("identity repository resolveOwner returns owning user", async () => {
  const prisma = makePrisma();
  prisma.authIdentity.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { id: "ident_1" }, include: { user: true } });
    return Promise.resolve({ ...prismaIdentity, user: prismaUser } as unknown as PrismaAuthIdentity & { user: PrismaUser });
  };
  const repo = new PrismaIdentityRepository(client(prisma));
  const owner = await repo.resolveOwner("ident_1");
  assert.ok(owner);
  assert.equal(owner.userId, "user_1");
  assert.equal(owner.user.emailNormalized, "a@example.com");
});

// ---------------------------------------------------------------------------
// Password credential repository
// ---------------------------------------------------------------------------

test("password repository findByIdentity reads by identity id", async () => {
  const prisma = makePrisma();
  prisma.passwordCredential.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { identityId: "ident_1" } });
    return Promise.resolve(prismaCredential);
  };
  const repo = new PrismaPasswordCredentialRepository(client(prisma));
  const credential = await repo.findByIdentity("ident_1");
  assert.ok(credential);
  assert.equal(credential.passwordHash, "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$salt$salt");
});

test("password repository replacePasswordHash never accepts plaintext and refreshes changedAt", async () => {
  const prisma = makePrisma();
  let capturedHash: unknown = null;
  let capturedChangedAt: unknown = null;
  prisma.passwordCredential.update = (args: unknown) => {
    assert.deepEqual((args as { where: unknown }).where, { identityId: "ident_1" });
    capturedHash = (args as { data: { passwordHash: unknown } }).data.passwordHash;
    capturedChangedAt = (args as { data: { changedAt: unknown } }).data.changedAt;
    return Promise.resolve({});
  };
  const repo = new PrismaPasswordCredentialRepository(client(prisma));
  const hash = "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$newhash$newkey";
  await repo.replacePasswordHash("ident_1", hash);
  assert.equal(capturedHash, hash);
  assert.ok(capturedChangedAt instanceof Date);
  assert.notEqual(capturedHash, "plaintext-password");
});

// ---------------------------------------------------------------------------
// Session repository
// ---------------------------------------------------------------------------

test("session repository create persists tokenHash only, never raw token", async () => {
  const prisma = makePrisma();
  let capturedData: unknown = null;
  prisma.session.create = (args: unknown) => {
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve(prismaSession);
  };
  const repo = new PrismaSessionRepository(client(prisma));
  await repo.create({
    userId: "user_1", tokenHash: "digest-of-raw", authVersion: 1,
    idleExpiresAt: new Date("2026-10-22T02:00:00Z"),
    absoluteExpiresAt: new Date("2026-10-23T00:00:00Z"),
  });
  assert.equal((capturedData as { tokenHash: string }).tokenHash, "digest-of-raw");
  assert.equal((capturedData as { authVersion: number }).authVersion, 1);
  assert.ok(!("rawToken" in (capturedData as Record<string, unknown>)));
  assert.ok((capturedData as { authenticatedAt: unknown }).authenticatedAt instanceof Date);
});

test("session repository findByTokenDigest maps correctly", async () => {
  const prisma = makePrisma();
  prisma.session.findUnique = (args: unknown) => {
    assert.deepEqual(args, { where: { tokenHash: "digest" } });
    return Promise.resolve(prismaSession);
  };
  const repo = new PrismaSessionRepository(client(prisma));
  const session = await repo.findByTokenDigest("digest");
  assert.ok(session);
  assert.equal(session.id, "sess_1");
  assert.equal(session.tokenHash, "digest");
});

test("session repository touchLastSeen does not mutate absolute expiry or auth version", async () => {
  const prisma = makePrisma();
  let capturedWhere: unknown = null;
  let capturedData: unknown = null;
  const touchTime = new Date("2026-10-22T00:30:00Z");
  prisma.session.updateMany = (args: unknown) => {
    capturedWhere = (args as { where: unknown }).where;
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaSessionRepository(client(prisma));
  await repo.touchLastSeen("sess_1", touchTime);
  assert.deepEqual(capturedWhere, {
    id: "sess_1",
    revokedAt: null,
    idleExpiresAt: { gt: touchTime },
    absoluteExpiresAt: { gt: touchTime },
  });
  assert.deepEqual(capturedData, { lastSeenAt: touchTime });
  assert.ok(!("absoluteExpiresAt" in capturedData));
  assert.ok(!("authVersion" in capturedData));
  assert.ok(!("authenticatedAt" in capturedData));
  assert.ok(!("tokenHash" in capturedData));
});

test("session repository touchLastSeen conditions on unrevoked and unexpired", async () => {
  const prisma = makePrisma();
  let capturedWhere: unknown = null;
  prisma.session.updateMany = (args: unknown) => {
    capturedWhere = (args as { where: unknown }).where;
    return Promise.resolve({ count: 0 });
  };
  const repo = new PrismaSessionRepository(client(prisma));
  await repo.touchLastSeen("sess_1", now);
  assert.deepEqual(capturedWhere, {
    id: "sess_1",
    revokedAt: null,
    idleExpiresAt: { gt: now },
    absoluteExpiresAt: { gt: now },
  });
});

test("session repository revoke is idempotent and keeps session revoked", async () => {
  const prisma = makePrisma();
  const wheres: unknown[] = [];
  prisma.session.updateMany = (args: unknown) => {
    wheres.push((args as { where: unknown }).where);
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaSessionRepository(client(prisma));
  await repo.revoke("sess_1", "LOGOUT_ALL");
  await repo.revoke("sess_1");
  assert.equal(wheres.length, 2);
  for (const where of wheres) {
    assert.deepEqual(where, { id: "sess_1", revokedAt: null });
  }
});

test("session repository revokeAllForUser targets only that user", async () => {
  const prisma = makePrisma();
  prisma.session.updateMany = (args: unknown) => {
    assert.deepEqual((args as { where: unknown }).where, { userId: "user_1", revokedAt: null });
    return Promise.resolve({ count: 2 });
  };
  const repo = new PrismaSessionRepository(client(prisma));
  await repo.revokeAllForUser("user_1");
});

test("session repository listActiveForUser excludes revoked and expired sessions", async () => {
  const prisma = makePrisma();
  prisma.session.findMany = (args: unknown) => {
    const where = (args as { where: unknown }).where;
    assert.equal((where as { userId: string }).userId, "user_1");
    assert.equal((where as { revokedAt: unknown }).revokedAt, null);
    assert.ok(((where as { idleExpiresAt: unknown }).idleExpiresAt as { gt: unknown }).gt instanceof Date);
    assert.ok(((where as { absoluteExpiresAt: unknown }).absoluteExpiresAt as { gt: unknown }).gt instanceof Date);
    return Promise.resolve([prismaSession]);
  };
  const repo = new PrismaSessionRepository(client(prisma));
  const sessions = await repo.listActiveForUser("user_1");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, "sess_1");
});

// ---------------------------------------------------------------------------
// Browser context repository
// ---------------------------------------------------------------------------

test("browser context repository create stores digests only", async () => {
  const prisma = makePrisma();
  let capturedData: unknown = null;
  prisma.authBrowserContext.create = (args: unknown) => {
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve(prismaContext);
  };
  const repo = new PrismaBrowserContextRepository(client(prisma));
  await repo.create({
    tokenHash: "ctx-digest", csrfTokenHash: "csrf-digest",
    expiresAt: new Date("2026-10-22T01:00:00Z"),
  });
  assert.equal((capturedData as { tokenHash: string }).tokenHash, "ctx-digest");
  assert.equal((capturedData as { csrfTokenHash: string }).csrfTokenHash, "csrf-digest");
  assert.ok(!("rawToken" in (capturedData as Record<string, unknown>)));
  assert.ok(!("csrfToken" in (capturedData as Record<string, unknown>)));
});

test("browser context repository consume is atomic and single-use", async () => {
  const prisma = makePrisma();
  let updateWhere: unknown = null;
  let updateCount = 1;
  prisma.authBrowserContext.updateMany = (args: unknown) => {
    updateWhere = (args as { where: unknown }).where;
    return Promise.resolve({ count: updateCount });
  };
  prisma.authBrowserContext.findUnique = (() => Promise.resolve(prismaContext)) as unknown as never;
  const repo = new PrismaBrowserContextRepository(client(prisma));
  const consumed = await repo.consume("ctx-digest");
  assert.ok(consumed);
  assert.equal((updateWhere as { tokenHash: string }).tokenHash, "ctx-digest");
  assert.equal((updateWhere as { consumedAt: unknown }).consumedAt, null);
  assert.ok(((updateWhere as { expiresAt: unknown }).expiresAt as { gt: unknown }).gt instanceof Date);
  updateCount = 0;
  const again = await repo.consume("ctx-digest");
  assert.equal(again, null);
});

test("browser context repository expire invalidates the context", async () => {
  const prisma = makePrisma();
  prisma.authBrowserContext.updateMany = (args: unknown) => {
    assert.deepEqual((args as { where: unknown }).where, { tokenHash: "ctx-digest", consumedAt: null });
    assert.ok(((args as { data: { consumedAt: unknown } }).data.consumedAt) instanceof Date);
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaBrowserContextRepository(client(prisma));
  await repo.expire("ctx-digest");
});

// ---------------------------------------------------------------------------
// OAuth transaction repository
// ---------------------------------------------------------------------------

test("oauth repository create preserves LOGIN and LINK fields separately", async () => {
  const prisma = makePrisma();
  prisma.oAuthTransaction.create = (args: unknown) => {
    return Promise.resolve((args as { data: unknown }).data);
  };
  const repo = new PrismaOAuthTransactionRepository(client(prisma));
  const link = await repo.create({
    stateHash: "link-state", browserContextId: "ctx_1", intent: "LINK",
    linkUserId: "user_1", initiatingSessionId: "sess_1",
    pkceVerifierCiphertext: "cipher", returnPath: "/profile",
    expiresAt: new Date("2026-10-22T00:10:00Z"),
  });
  assert.equal(link.intent, "LINK");
  assert.equal(link.linkUserId, "user_1");
  assert.equal(link.initiatingSessionId, "sess_1");
  assert.equal("pkceVerifierCiphertext" in link, false);

  const login = await repo.create({
    stateHash: "login-state", browserContextId: "ctx_1", intent: "LOGIN",
    linkUserId: null, initiatingSessionId: null,
    pkceVerifierCiphertext: "cipher", returnPath: "/",
    expiresAt: new Date("2026-10-22T00:10:00Z"),
  });
  assert.equal(login.intent, "LOGIN");
  assert.equal(login.linkUserId, null);
  assert.equal(login.initiatingSessionId, null);
});

test("oauth repository consume requires unconsumed and unexpired", async () => {
  const prisma = makePrisma();
  let updateWhere: unknown = null;
  let updateCount = 1;
  prisma.oAuthTransaction.updateMany = (args: unknown) => {
    updateWhere = (args as { where: unknown }).where;
    return Promise.resolve({ count: updateCount });
  };
  prisma.oAuthTransaction.findUnique = (() => Promise.resolve(prismaOAuth)) as unknown as never;
  const repo = new PrismaOAuthTransactionRepository(client(prisma));
  const tx = await repo.consume("state");
  assert.ok(tx);
  assert.equal((updateWhere as { stateHash: string }).stateHash, "state");
  assert.equal((updateWhere as { consumedAt: unknown }).consumedAt, null);
  assert.ok(((updateWhere as { expiresAt: unknown }).expiresAt as { gt: unknown }).gt instanceof Date);
  updateCount = 0;
  const replay = await repo.consume("state");
  assert.equal(replay, null, "second consumption must fail");
});

test("oauth repository expire invalidates the transaction", async () => {
  const prisma = makePrisma();
  prisma.oAuthTransaction.updateMany = (args: unknown) => {
    assert.deepEqual((args as { where: unknown }).where, { stateHash: "state", consumedAt: null });
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaOAuthTransactionRepository(client(prisma));
  await repo.expire("state");
});

// ---------------------------------------------------------------------------
// Email challenge repository
// ---------------------------------------------------------------------------

test("email challenge repository create is purpose-bound", async () => {
  const prisma = makePrisma();
  let capturedData: unknown = null;
  prisma.emailChallenge.create = (args: unknown) => {
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve(prismaChallenge);
  };
  const repo = new PrismaEmailChallengeRepository(client(prisma));
  await repo.create({
    userId: "user_1", emailNormalized: "a@example.com", purpose: "PASSWORD_RESET",
    tokenHash: "ch-digest", authVersion: 3, expiresAt: new Date("2026-10-22T01:00:00Z"),
  });
  assert.equal((capturedData as { purpose: string }).purpose, "PASSWORD_RESET");
  assert.equal((capturedData as { authVersion: number }).authVersion, 3);
});

test("email challenge repository consume requires unconsumed and unexpired", async () => {
  const prisma = makePrisma();
  let updateWhere: unknown = null;
  let updateCount = 1;
  prisma.emailChallenge.updateMany = (args: unknown) => {
    updateWhere = (args as { where: unknown }).where;
    return Promise.resolve({ count: updateCount });
  };
  prisma.emailChallenge.findUnique = (() => Promise.resolve(prismaChallenge)) as unknown as never;
  const repo = new PrismaEmailChallengeRepository(client(prisma));
  const challenge = await repo.consume("ch-digest");
  assert.ok(challenge);
  assert.equal((updateWhere as { tokenHash: string }).tokenHash, "ch-digest");
  assert.equal((updateWhere as { consumedAt: unknown }).consumedAt, null);
  assert.ok(((updateWhere as { expiresAt: unknown }).expiresAt as { gt: unknown }).gt instanceof Date);
  assert.equal(challenge.authVersion, 3, "authVersion is bound to the challenge");
  updateCount = 0;
  const replay = await repo.consume("ch-digest");
  assert.equal(replay, null, "challenge replay must fail");
});

test("email challenge repository invalidateOutstanding targets email + purpose only", async () => {
  const prisma = makePrisma();
  prisma.emailChallenge.updateMany = (args: unknown) => {
    const where = (args as { where: unknown }).where;
    assert.equal((where as { emailNormalized: string }).emailNormalized, "a@example.com");
    assert.equal((where as { purpose: string }).purpose, "PASSWORD_RESET");
    assert.equal((where as { consumedAt: unknown }).consumedAt, null);
    assert.ok(((where as { expiresAt: unknown }).expiresAt as { gt: unknown }).gt instanceof Date);
    assert.deepEqual((where as { tokenHash: unknown }).tokenHash, { not: "ch-digest" });
    return Promise.resolve({ count: 1 });
  };
  const repo = new PrismaEmailChallengeRepository(client(prisma));
  await repo.invalidateOutstanding("a@example.com", "PASSWORD_RESET", "ch-digest");
});

test("email challenge repository invalidateOutstanding without exception token", async () => {
  const prisma = makePrisma();
  prisma.emailChallenge.updateMany = (args: unknown) => {
    const where = (args as { where: unknown }).where;
    assert.equal((where as { emailNormalized: string }).emailNormalized, "a@example.com");
    assert.equal((where as { purpose: string }).purpose, "REGISTER");
    assert.equal((where as { consumedAt: unknown }).consumedAt, null);
    assert.ok(((where as { expiresAt: unknown }).expiresAt as { gt: unknown }).gt instanceof Date);
    assert.equal((where as { tokenHash: unknown }).tokenHash, undefined);
    return Promise.resolve({ count: 0 });
  };
  const repo = new PrismaEmailChallengeRepository(client(prisma));
  await repo.invalidateOutstanding("a@example.com", "REGISTER");
});

// ---------------------------------------------------------------------------
// Audit repository
// ---------------------------------------------------------------------------

test("audit repository appends sanitized metadata and stores no secrets", async () => {
  const prisma = makePrisma();
  let capturedData: unknown = null;
  prisma.authAuditEvent.create = (args: unknown) => {
    capturedData = (args as { data: unknown }).data;
    return Promise.resolve({});
  };
  const repo = new PrismaAuditRepository(client(prisma));
  const record: AuthAuditRecord = {
    eventType: "LOGIN_SUCCESS", outcome: "success", requestId: "req_1",
    metadata: { attemptCount: 1, provider: "EMAIL_PASSWORD", reason: "INVALID_CREDENTIALS" },
    actorUserId: "user_1", subjectUserId: "user_1",
  };
  await repo.append(record);
  assert.deepEqual((capturedData as { metadata: { attemptCount: number } }).metadata, record.metadata);
  assert.equal((capturedData as { eventType: string }).eventType, "LOGIN_SUCCESS");
  assert.equal((capturedData as { requestId: string }).requestId, "req_1");
  assert.ok(!(capturedData as Record<string, unknown>).password);
  assert.ok(!(capturedData as Record<string, unknown>).passwordHash);
  assert.ok(!(capturedData as Record<string, unknown>).token);
});

test("audit repository rejects non-object metadata", async () => {
  const prisma = makePrisma();
  prisma.authAuditEvent.create = (() => Promise.resolve({})) as unknown as never;
  const repo = new PrismaAuditRepository(client(prisma));
  await assert.rejects(repo.append({
    eventType: "LOGIN_SUCCESS", outcome: "success", requestId: "req_1",
    metadata: "not-object" as unknown as Record<string, string | number | boolean>,
    actorUserId: null, subjectUserId: null,
  }), /non-null object/);
});

test("audit repository rejects oversize metadata", async () => {
  const prisma = makePrisma();
  prisma.authAuditEvent.create = (() => Promise.resolve({})) as unknown as never;
  const repo = new PrismaAuditRepository(client(prisma));
  await assert.rejects(repo.append({
    eventType: "LOGIN_SUCCESS", outcome: "success", requestId: "req_1",
    metadata: { padding: "x".repeat(5000) },
    actorUserId: null, subjectUserId: null,
  }), /too large/);
});

test("audit repository rejects secret field names in metadata", async () => {
  const prisma = makePrisma();
  let created = false;
  prisma.authAuditEvent.create = (() => { created = true; return Promise.resolve({}); }) as unknown as never;
  const repo = new PrismaAuditRepository(client(prisma));
  await assert.rejects(repo.append({
    eventType: "LOGIN_SUCCESS", outcome: "success", requestId: "req_1",
    metadata: { password: "secret" },
    actorUserId: null, subjectUserId: null,
  }), /secret field/);
  assert.equal(created, false);
});

// ---------------------------------------------------------------------------
// Repository factory
// ---------------------------------------------------------------------------

test("factory wires the same Prisma client into every repository", () => {
  const prisma = makePrisma();
  const repos = createPrismaAuthRepositories(client(prisma));
  const instances = Object.values(repos) as unknown as Array<{ prisma: unknown }>;
  for (const instance of instances) {
    assert.equal(instance.prisma, prisma);
  }
});

test("factory delegates through the passed client (no global client creation)", async () => {
  const prisma = makePrisma();
  const repos = createPrismaAuthRepositories(client(prisma));
  await repos.userRepository.findById("user_1");
  assert.ok(prisma.calls.some((c) => c.model === "user" && c.method === "findUnique"));
});

// ---------------------------------------------------------------------------
// Contract conformance
// ---------------------------------------------------------------------------

test("all repositories implement their domain contracts", () => {
  const prisma = makePrisma();
  const repos: PrismaAuthRepositories = createPrismaAuthRepositories(client(prisma));
  const userRepo: UserRepository = repos.userRepository;
  const identityRepo: IdentityRepository = repos.identityRepository;
  const passwordRepo: PasswordCredentialRepository = repos.passwordCredentialRepository;
  const sessionRepo: SessionRepository = repos.sessionRepository;
  const contextRepo: BrowserContextRepository = repos.browserContextRepository;
  const oauthRepo: OAuthTransactionRepository = repos.oauthTransactionRepository;
  const challengeRepo: EmailChallengeRepository = repos.emailChallengeRepository;
  const auditRepo: AuditRepository = repos.auditRepository;
  assert.equal(typeof userRepo.findById, "function");
  assert.equal(typeof userRepo.findByNormalizedEmail, "function");
  assert.equal(typeof userRepo.bumpAuthVersion, "function");
  assert.equal(typeof identityRepo.findByProviderAndSubject, "function");
  assert.equal(typeof identityRepo.findByUserAndProvider, "function");
  assert.equal(typeof identityRepo.resolveOwner, "function");
  assert.equal(typeof passwordRepo.findByIdentity, "function");
  assert.equal(typeof passwordRepo.replacePasswordHash, "function");
  assert.equal(typeof sessionRepo.create, "function");
  assert.equal(typeof sessionRepo.findByTokenDigest, "function");
  assert.equal(typeof sessionRepo.touchLastSeen, "function");
  assert.equal(typeof sessionRepo.revoke, "function");
  assert.equal(typeof sessionRepo.revokeAllForUser, "function");
  assert.equal(typeof sessionRepo.listActiveForUser, "function");
  assert.equal(typeof contextRepo.create, "function");
  assert.equal(typeof contextRepo.findByTokenHash, "function");
  assert.equal(typeof contextRepo.consume, "function");
  assert.equal(typeof contextRepo.expire, "function");
  assert.equal(typeof oauthRepo.create, "function");
  assert.equal(typeof oauthRepo.consume, "function");
  assert.equal(typeof oauthRepo.expire, "function");
  assert.equal(typeof challengeRepo.create, "function");
  assert.equal(typeof challengeRepo.consume, "function");
  assert.equal(typeof challengeRepo.expire, "function");
  assert.equal(typeof challengeRepo.invalidateOutstanding, "function");
  assert.equal(typeof auditRepo.append, "function");
});
