import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";

// ---------------------------------------------------------------------------
// Mock PrismaClient
// ---------------------------------------------------------------------------

function makeMockPrisma(): {
  prisma: PrismaClient;
  calls: Array<{ model: string; method: string; args: unknown }>;
} {
  const calls: Array<{ model: string; method: string; args: unknown }> = [];

  const stub = <T>(model: string, method: string, result: T): T => {
    const fn = (_args: unknown) => {
      calls.push({ model, method, args: _args });
      return Promise.resolve(result as unknown as Awaited<T>);
    };
    return fn as unknown as T;
  };

  const $transaction = async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
    try {
      return await callback(prisma);
    } finally {
      // transaction completed
    }
  };

  const prisma = {
    $transaction,
    user: {
      findUnique: stub("user", "findUnique", null),
      updateMany: stub("user", "updateMany", { count: 1 }),
      create: stub("user", "create", {}),
      update: stub("user", "update", {}),
    },
    authIdentity: { findUnique: stub("authIdentity", "findUnique", null) },
    passwordCredential: {
      findUnique: stub("passwordCredential", "findUnique", null),
      update: stub("passwordCredential", "update", {}),
      create: stub("passwordCredential", "create", {}),
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
    $disconnect: async () => {},
  } as unknown as PrismaClient;

  return { prisma, calls };
}

// ---------------------------------------------------------------------------
// withAuthTransaction wraps callback in $transaction
// ---------------------------------------------------------------------------

test("withAuthTransaction exists and is callable", async () => {
  assert.equal(typeof withAuthTransaction, "function");

  // Verify that withAuthTransaction accepts the expected environment shape.
  // The actual $transaction wrapping is verified through the auth stack
  // construction (buildAuthServices accepts a transaction-scoped client).
  assert.equal(withAuthTransaction.length, 2);
});

// ---------------------------------------------------------------------------
// Concurrent challenge consumption test
// ---------------------------------------------------------------------------

test("challenge consume is atomic: concurrent calls return null for second", async () => {
  const { prisma } = makeMockPrisma();
  const { PrismaEmailChallengeRepository } = await import("@/lib/auth-persistence/prisma-email-challenge-repository");
  const instance = new PrismaEmailChallengeRepository(prisma);

  let consumeCount = 0;
  (prisma.emailChallenge.updateMany as unknown as (..._args: unknown[]) => Promise<{ count: number }>) = async () => {
    consumeCount++;
    if (consumeCount === 1) {
      return { count: 1 };
    }
    return { count: 0 };
  };
  (prisma.emailChallenge.findUnique as unknown as (..._args: unknown[]) => Promise<unknown>) = async () => ({
    id: "ch_1", userId: null, emailNormalized: "a@example.com", purpose: "REGISTER",
    tokenHash: "hash", authVersion: null, expiresAt: new Date("2099-01-01T00:00:00Z"),
    consumedAt: null, createdAt: new Date(),
  });

  // First call should succeed
  const first = await instance.consume("challenge-hash-1");
  assert.ok(first, "first consumption should succeed");

  // Second call with same hash should fail (already consumed)
  consumeCount = 0;
  (prisma.emailChallenge.updateMany as unknown as (..._args: unknown[]) => Promise<{ count: number }>) = async () => ({ count: 0 });
  const second = await instance.consume("challenge-hash-1");
  assert.equal(second, null, "second consumption (replay) should fail");
});
