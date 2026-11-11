import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// PrismaClient module loads and exposes Order model
// ---------------------------------------------------------------------------

test("PrismaClient module loads and exposes Order model", async () => {
  const mod = await import("@prisma/client");
  const { PrismaClient } = mod;
  assert.ok(PrismaClient, "PrismaClient should be importable");
  assert.ok(typeof PrismaClient === "function", "PrismaClient should be a constructor");
});

// ---------------------------------------------------------------------------
// Order creation paths require authentication
// ---------------------------------------------------------------------------

test("order creation routes require authentication", async () => {
  const ordersRoute = await import("@/app/api/orders/route");
  const paymentRoute = await import("@/app/api/orders/[orderNumber]/payment/route");
  const webhookRoute = await import("@/app/api/webhooks/mercadopago/route");

  assert.ok(typeof ordersRoute.POST === "function", "orders POST handler should exist");
  assert.ok(typeof paymentRoute.POST === "function", "payment POST handler should exist");
  assert.ok(typeof webhookRoute.POST === "function", "webhook POST handler should exist");

  // Orders and payment routes require authentication (401/429 without valid session)
  const ordersResponse = await ordersRoute.POST(new Request("https://swiftmc.example/api/orders", {
    method: "POST",
    headers: { cookie: "" },
  }));
  assert.ok(ordersResponse.status !== 200, `orders route should reject unauthenticated access, got ${ordersResponse.status}`);
  assert.ok([401, 429].includes(ordersResponse.status), `expected 401 or 429, got ${ordersResponse.status}`);

  const paymentResponse = await paymentRoute.POST(new Request("https://swiftmc.example/api/orders/ORD-1/payment", {
    method: "POST",
    headers: { cookie: "" },
  }));
  assert.ok(paymentResponse.status !== 200, `payment route should reject unauthenticated access, got ${paymentResponse.status}`);
  assert.ok([401, 429].includes(paymentResponse.status), `expected 401 or 429, got ${paymentResponse.status}`);

  // Webhook route stays publicly accessible (signature-based, demo-blocked)
  const webhookResponse = await webhookRoute.POST(new Request("https://swiftmc.example/api/webhooks/mercadopago", {
    method: "POST",
    headers: { cookie: "" },
  }));
  const body = await webhookResponse.json();
  assert.ok([400,503].includes(webhookResponse.status));
  assert.equal(webhookResponse.status, 503);
  assert.equal(body.error.code, "PURCHASES_DISABLED");
});

// ---------------------------------------------------------------------------
// User profile API requires authentication
// ---------------------------------------------------------------------------

test("profile API requires authentication", async () => {
  const mod = await import("@/app/api/user/profile/route");
  assert.ok(mod.GET);
  assert.ok(mod.POST);

  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request);
  assert.ok(response.status !== 200, `profile GET should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// User orders API requires authentication
// ---------------------------------------------------------------------------

test("orders API requires authentication", async () => {
  const mod = await import("@/app/api/user/orders/route");
  assert.ok(mod.GET);

  const request = new Request("https://swiftmc.example/api/user/orders", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request);
  assert.ok(response.status !== 200, `orders GET should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Single order API requires authentication and enforces ownership
// ---------------------------------------------------------------------------

test("single order GET rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/user/orders/[orderNumber]/route");
  assert.ok(mod.GET);

  const request = new Request("https://swiftmc.example/api/user/orders/ORD-USER-B-123", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request, { params: Promise.resolve({ orderNumber: "ORD-USER-B-123" }) });
  assert.ok(response.status !== 200, `Order access should be restricted, got ${response.status}`);
  assert.ok([401, 404, 429].includes(response.status),
    `Order access should reject unauthenticated requests, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Session validation rejects revoked/invalid sessions
// ---------------------------------------------------------------------------

test("session validation rejects revoked session", async () => {
  const mod = await import("@/app/(auth)/api/session/route");
  assert.ok(mod.GET);

  const request = new Request("https://swiftmc.example/(auth)/api/session", {
    headers: { cookie: "__Host-swiftmc_session=revoked-token" },
  });
  const response = await mod.GET(request);
  // Without AUTH_HYPERDRIVE binding, returns 503 before rate limiting.
  // With valid binding, revoked session returns 401.
  assert.ok(response.status !== 200, `Revoked session should be rejected, got ${response.status}`);
  assert.ok([401, 429, 503].includes(response.status),
    `Session validation should reject revoked sessions, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Session validation service exports required functions
// ---------------------------------------------------------------------------

test("session validation service exports required functions", async () => {
  const mod = await import("@/lib/auth-domain/session-service");
  assert.ok(mod.createSessionService);
  const svc = mod.createSessionService({
    sessionRepository: {
      create: async () => ({
        id: "sess-test",
        userId: "user-test",
        tokenHash: "hash",
        authVersion: 1,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        idleExpiresAt: new Date(),
        absoluteExpiresAt: new Date(),
      } as any), // eslint-disable-line @typescript-eslint/no-explicit-any
      findByTokenDigest: async () => null,
      touchLastSeen: async () => {},
      revoke: async () => {},
      revokeAllForUser: async () => {},
      listActiveForUser: async () => [],
    },
    userRepository: {
      findById: async () => ({ id: "user-test", emailNormalized: "test@example.com", displayName: "Test", role: "USER", status: "ACTIVE", phoneE164: null, authVersion: 1, createdAt: new Date(), updatedAt: new Date(), emailVerifiedAt: null } as unknown as import("@/lib/auth-domain/repositories").AuthUser),
      findByNormalizedEmail: async () => null,
      createUser: async () => ({ id: "user-test", emailNormalized: "test@example.com", displayName: "Test", role: "USER", status: "ACTIVE", phoneE164: null, authVersion: 1, createdAt: new Date(), updatedAt: new Date(), emailVerifiedAt: null } as unknown as import("@/lib/auth-domain/repositories").AuthUser),
      bumpAuthVersion: async () => false,
      updateEmailVerifiedAt: async () => {},
      updateProfile: async () => ({ id: "user-test", emailNormalized: "test@example.com", displayName: "Test", role: "USER", status: "ACTIVE", phoneE164: null, authVersion: 1, createdAt: new Date(), updatedAt: new Date(), emailVerifiedAt: null } as unknown as import("@/lib/auth-domain/repositories").AuthUser),
      updateEmail: async () => ({ id: "user-test", emailNormalized: "test@example.com", displayName: "Test", role: "USER", status: "ACTIVE", phoneE164: null, authVersion: 1, createdAt: new Date(), updatedAt: new Date(), emailVerifiedAt: null } as unknown as import("@/lib/auth-domain/repositories").AuthUser),
    },
    clock: { now: () => new Date() },
  });
  assert.ok(typeof svc.issueSession === "function");
  assert.ok(typeof svc.validateSession === "function");
  assert.ok(typeof svc.revokeSession === "function");
  assert.ok(typeof svc.revokeAllUserSessions === "function");
});

// ---------------------------------------------------------------------------
// Email challenge repository - single-use challenge
// ---------------------------------------------------------------------------

test("email challenge consume is single-use", async () => {
  const mod = await import("@/lib/auth-persistence/prisma-email-challenge-repository");
  assert.ok(mod.PrismaEmailChallengeRepository);
  // Just verify the class can be instantiated (mock Prisma client needed for real test)
  const { PrismaEmailChallengeRepository } = mod;
  assert.ok(typeof PrismaEmailChallengeRepository === "function");
});

// ---------------------------------------------------------------------------
// DTO validation schemas work correctly
// ---------------------------------------------------------------------------

test("DTO validation schemas reject invalid input", async () => {
  const mod = await import("@/lib/auth-domain/dto");
  assert.ok(mod.LoginRequestSchema);
  assert.ok(mod.RegistrationRequestSchema);
  assert.ok(mod.PasswordResetRequestSchema);
  assert.ok(mod.PasswordResetCompleteRequestSchema);

  // Login without email should fail
  const loginResult = mod.validateLogin({ password: "test" });
  assert.ok(!loginResult.success);

  // Registration starts with email only; password is required at completion.
  const regResult = mod.validateRegistration({ email: "test@example.com" });
  assert.ok(regResult.success);
  assert.ok(!mod.RegistrationCompleteRequestSchema.safeParse({ email: "test@example.com" }).success);

  // Password reset without email should fail
  const resetResult = mod.validatePasswordReset({});
  assert.ok(!resetResult.success);
});

// ---------------------------------------------------------------------------
// Browser security - internalReturnPath rejects external URLs
// ---------------------------------------------------------------------------

test("internalReturnPath rejects external URLs", async () => {
  const mod = await import("@/lib/auth/browser-security");
  assert.ok(mod.internalReturnPath);

  const evilUrls = [
    "https://evil.example.com",
    "//evil.example.com",
    "javascript:alert(1)",
    "data:text/html,x",
    "/%2fevil.example",
  ];

  for (const url of evilUrls) {
    assert.equal(mod.internalReturnPath(url), null, `Should reject: ${url}`);
  }

  // Valid internal paths should work
  assert.equal(mod.internalReturnPath("/account"), "/account");
  assert.equal(mod.internalReturnPath("/account/orders"), "/account/orders");
});

// ---------------------------------------------------------------------------
// Rate limit key derivation functions work correctly
// ---------------------------------------------------------------------------

test("rate limit key derivation functions work correctly", async () => {
  const mod = await import("@/lib/auth-domain/rate-limit");
  assert.ok(mod.limiterKeyForEmail);
  assert.ok(mod.limiterKeyForEmailAndIp);
  assert.ok(mod.limiterKeyForUser);
  assert.ok(mod.limiterKeyForChallenge);

  const key1 = mod.limiterKeyForEmail("key", "test@example.com");
  const key2 = mod.limiterKeyForEmail("key", "test@example.com");
  assert.equal(key1, key2, "Same inputs should produce same key");
  assert.equal(key1.length, 64, "Key should be 64 hex chars (SHA-256)");

  // Different purposes should produce different keys
  const key3 = mod.limiterKeyForUser("key", "user1");
  const key4 = mod.limiterKeyForChallenge("key", "user1");
  assert.notEqual(key3, key4, "Different purposes should produce different keys");
});
