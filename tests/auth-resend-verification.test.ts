import assert from "node:assert/strict";
import test, { mock, beforeEach } from "node:test";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";
import { createRegistrationService, type RegistrationDeps } from "@/lib/auth-domain/registration";

// Mock only infrastructure boundaries; execute real route, DTO, rate-limit
// key derivation and cookie serialization. No external services.
const user = {
  id: "alice",
  emailNormalized: "alice@example.com",
  emailVerifiedAt: null,
  status: "ACTIVE",
  authVersion: 1,
  displayName: "Alice",
  createdAt: new Date(),
  updatedAt: new Date(),
};
const verifiedUser = {
  id: "bob",
  emailNormalized: "bob@example.com",
  emailVerifiedAt: new Date(),
  status: "ACTIVE",
  authVersion: 1,
  displayName: "Bob",
  createdAt: new Date(),
  updatedAt: new Date(),
};
let keys: string[] = [];
let allow = true;
let failLimiter = false;
let emailSendCalls: Array<{ to: string; token: string }> = [];
let emailSendError: Error | null = null;
let invalidateOutstandingCalls: Array<{ email: string; purpose: string }> = [];

const env: Partial<AuthBindings> & { APP_URL: string } = {
  APP_URL: "https://swiftmc.example",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://unused.invalid/test" },
  AUTH_RATE_LIMIT: { async limit({ key }: { key: string }) {
    keys.push(key);
    if (failLimiter) throw new Error("offline");
    return { success: allow };
  } },
};
const emailChallenge = {
  async invalidateOutstanding(emailNormalized: string, purpose: string) {
    invalidateOutstandingCalls.push({ email: emailNormalized, purpose });
  },
  async create(params: {
    userId: string | null;
    emailNormalized: string;
    purpose: string;
    tokenHash: string;
    authVersion: number | null;
    expiresAt: Date;
  }) {
    return { id: "challenge-1", ...params, consumedAt: null, createdAt: new Date() };
  },
};
const prisma = {
  user: {
    async findByNormalizedEmail(email: string) {
      if (email === user.emailNormalized) return user;
      if (email === verifiedUser.emailNormalized) return verifiedUser;
      return null;
    },
  },
  emailChallenge,
};
const services = {
  registrationService: createRegistrationService({
    userRepository: prisma.user, emailChallengeRepository: prisma.emailChallenge,
    clock: { now: () => new Date() }, auditRepository: { async append() {} },
  } as unknown as RegistrationDeps),
  repositories: {
    userRepository: prisma.user,
    emailChallengeRepository: prisma.emailChallenge,
  },
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/auth-api/verification-transaction", { namedExports: {
  withVerificationTransaction: async (_env: unknown, _email: string, callback: (value: typeof services) => unknown) => callback(services),
} });
mock.module("@/lib/auth/email-service", { namedExports: {
  createEmailService: () => {
    if (emailSendError) {
      return {
        sendVerificationEmail: async () => { throw emailSendError; },
        sendPasswordResetEmail: async () => { throw emailSendError; },
      };
    }
    return {
      sendVerificationEmail: async (params: { to: string; token: string }) => {
        emailSendCalls.push({ to: params.to, token: params.token });
      },
      sendPasswordResetEmail: async () => {},
    };
  },
} });

const resend = await import("@/app/(auth)/api/auth/resend-verification/route");

beforeEach(() => {
  keys = [];
  allow = true;
  failLimiter = false;
  emailSendCalls = [];
  emailSendError = null;
  invalidateOutstandingCalls = [];
});

function request(body?: object, overrides: Record<string, string> = {}) {
  return new Request(`https://swiftmc.example/api/auth/resend-verification`, {
    method: "POST",
    headers: { origin: "https://swiftmc.example", "content-type": "application/json", "sec-fetch-site": "same-origin",
      cookie: `__Host-swiftmc_session=dummy; __Host-swiftmc_csrf=csrf-token`, "x-csrf-token": "csrf-token", ...overrides },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("resend verification sends email and returns generic acknowledgement for unverified account", async () => {
  const response = await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.acknowledgement, "Se for possível, enviaremos as instruções para o email informado.");
  assert.equal(emailSendCalls.length, 1);
  assert.equal(emailSendCalls[0].to, "alice@example.com");
  assert.equal(emailSendCalls[0].token.length, 43);
  assert.equal(keys.length, 2);
  assert.equal(invalidateOutstandingCalls.length, 1);
  assert.equal(invalidateOutstandingCalls[0].email, "alice@example.com");
  assert.equal(invalidateOutstandingCalls[0].purpose, "REGISTER");
});

test("resend verification returns identical generic acknowledgement for unknown account", async () => {
  const response = await resend.POST(request({ email: "nonexistent@example.com" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(emailSendCalls.length, 1, "pending registration does not require a User row");
  assert.equal(invalidateOutstandingCalls.length, 1);
});

test("resend verification returns identical generic acknowledgement for already verified account", async () => {
  const response = await resend.POST(request({ email: "bob@example.com" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(emailSendCalls.length, 0);
  assert.equal(invalidateOutstandingCalls.length, 0);
});

test("resend verification rate limit rejects when limiter denies", async () => {
  allow = false;
  const response = await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(response.status, 429);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification rate limit fails closed when limiter throws", async () => {
  failLimiter = true;
  const response = await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(response.status, 429);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification rejects cross-origin requests", async () => {
  const response = await resend.POST(request({ email: "alice@example.com" }, { origin: "https://evil.example" }));
  assert.equal(response.status, 403);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification rejects missing CSRF token", async () => {
  const response = await resend.POST(request({ email: "alice@example.com" }, { "x-csrf-token": "" }));
  assert.equal(response.status, 403);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification rejects invalid request body", async () => {
  const response = await resend.POST(request({ email: "not-an-email" }));
  assert.equal(response.status, 400);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification handles missing email configuration gracefully", async () => {
  // createEmailService returns null when RESEND_API_KEY is missing; route still
  // returns generic 200 and does not attempt to send.
  const response = await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
});

test("resend verification never reports false success when email delivery fails", async () => {
  emailSendError = new Error("Resend API error");
  const response = await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(emailSendCalls.length, 0);
});

test("resend verification invalidates previous challenges before creating new one", async () => {
  await resend.POST(request({ email: "alice@example.com" }));
  assert.equal(invalidateOutstandingCalls.length, 1);
  assert.equal(invalidateOutstandingCalls[0].email, "alice@example.com");
  assert.equal(invalidateOutstandingCalls[0].purpose, "REGISTER");
  assert.equal(emailSendCalls.length, 1);
});
