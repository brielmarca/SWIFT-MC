import assert from "node:assert/strict";
import test, { mock, beforeEach } from "node:test";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

// Mock only infrastructure boundaries; execute the real DTOs, domain services
// and route handlers so direct API calls cannot bypass the password policy.
const user = { id: "alice", emailNormalized: "alice@example.com", role: "USER", status: "ACTIVE", authVersion: 1, displayName: "Alice", createdAt: new Date(), updatedAt: new Date(), emailVerifiedAt: new Date() };
const rawToken = "S".repeat(43);
const env: Partial<AuthBindings> & { APP_URL: string } = {
  APP_URL: "https://swiftmc.example",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://unused.invalid/test" },
  AUTH_RATE_LIMIT: { async limit() { return { success: true }; } },
};

const changePasswordCalls: Array<{ email: string; currentPassword: string; newPassword: string; requestId: string }> = [];
const registrationCalls: Array<{ email: string; password: string; displayName: string; challengeToken: string; requestId: string }> = [];
const resetCompleteCalls: Array<{ email: string; challengeToken: string; newPassword: string; requestId: string }> = [];

const sessionService = {
  async validateSession({ token }: { token: string }) {
    return token === rawToken ? { ok: true, user, session: { id: "session-a" } } : { ok: false, code: "INVALID_TOKEN" };
  },
  async issueSession() {
    return { ok: true, session: { id: "session-b", absoluteExpiresAt: new Date(Date.now() + 60_000) }, rawToken: "T".repeat(43) };
  },
  async revokeAllUserSessions() {},
};
const services = {
  repositories: {
    userRepository: {}, identityRepository: {}, passwordCredentialRepository: {}, emailChallengeRepository: {}, auditRepository: {},
  },
  registrationService: { async requestRegistration() { return { ok: true, acknowledgement: "Check your email." }; } },
  loginService: {
    async login() { return { ok: true, user, rawToken, session: { id: "session-a", absoluteExpiresAt: new Date(Date.now() + 60_000) } }; },
    async changePassword(params: { email: string; currentPassword: string; newPassword: string; requestId: string }) {
      changePasswordCalls.push(params);
      return { ok: true };
    },
  },
  passwordResetService: {
    async requestPasswordReset() { return { ok: true, acknowledgement: "Check your email." }; },
    async completePasswordReset(params: { email: string; challengeToken: string; newPassword: string; requestId: string }) {
      resetCompleteCalls.push(params);
      return { ok: true, userId: "user_1" };
    },
  },
  sessionService,
};

mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/auth-api/auth-stack", { namedExports: {
  withAuthServices: async (_env: unknown, callback: (value: typeof services) => unknown) => callback(services),
  withAuthTransaction: async (_env: unknown, callback: (value: typeof services) => unknown) => callback(services),
} });
mock.module("@/lib/auth-api/verification-transaction", { namedExports: {
  withVerificationTransaction: async (_env: unknown, _email: string, callback: (value: typeof services) => unknown) => callback(services),
} });
mock.module("@/lib/auth-domain/email-verification", { namedExports: {
  createEmailVerificationService: () => ({
    completeRegistration: async (params: { email: string; password: string; displayName: string; challengeToken: string; requestId: string }) => {
      registrationCalls.push(params);
      return { ok: true, userId: "user_1" };
    },
    verifyEmail: async () => ({ ok: true, userId: "user_1" }),
  }),
} });

const verify = await import("@/app/(auth)/api/verify-email/route");
const passwordChange = await import("@/app/api/user/password/route");
const passwordResetComplete = await import("@/app/(auth)/api/password-reset/complete/route");

beforeEach(() => {
  changePasswordCalls.length = 0;
  registrationCalls.length = 0;
  resetCompleteCalls.length = 0;
});

function authRequest(path: string, body?: object, overrides: Record<string, string> = {}) {
  return new Request(`https://swiftmc.example${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin: "https://swiftmc.example", "content-type": "application/json", "sec-fetch-site": "same-origin",
      cookie: `__Host-swiftmc_session=${rawToken}; __Host-swiftmc_csrf=csrf-token`, "x-csrf-token": "csrf-token", ...overrides },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("direct registration completion API rejects passwords below the server minimum", async () => {
  const weak = await verify.POST(authRequest("/api/verify-email", {
    email: "alice@example.com", password: "short", displayName: "Alice", challengeToken: "T".repeat(43),
  }));
  assert.equal(weak.status, 400);
  assert.equal(registrationCalls.length, 0, "weak passwords never reach the registration completion flow");

  const boundary = await verify.POST(authRequest("/api/verify-email", {
    email: "alice@example.com", password: "SecurePass123!", displayName: "Alice", challengeToken: "T".repeat(43),
  }));
  assert.equal(boundary.status, 201);
  assert.equal(registrationCalls.length, 1, "the policy boundary of exactly 12 characters is accepted");
});

test("direct authenticated password change API rejects weak new passwords before credential mutation", async () => {
  const weak = await passwordChange.POST(authRequest("/api/user/password", {
    currentPassword: "current-password-123", newPassword: "short",
  }));
  assert.equal(weak.status, 400);
  assert.equal(changePasswordCalls.length, 0, "weak new passwords never reach the credential change flow");

  const tooShort = await passwordChange.POST(authRequest("/api/user/password", {
    currentPassword: "current-password-123", newPassword: "shortchars",
  }));
  assert.equal(tooShort.status, 400);
  assert.equal(changePasswordCalls.length, 0);

  const boundary = await passwordChange.POST(authRequest("/api/user/password", {
    currentPassword: "current-password-123", newPassword: "SecurePass123!",
  }));
  assert.equal(boundary.status, 200);
  assert.equal(changePasswordCalls.length, 1, "the policy boundary of exactly 12 characters is accepted");
});

test("direct password reset completion API rejects weak new passwords before challenge consumption", async () => {
  const weak = await passwordResetComplete.POST(authRequest("/api/password-reset/complete", {
    email: "alice@example.com", challengeToken: "T".repeat(43), newPassword: "short",
  }));
  assert.equal(weak.status, 400);
  assert.equal(resetCompleteCalls.length, 0, "weak reset passwords never reach the reset completion flow");

  const boundary = await passwordResetComplete.POST(authRequest("/api/password-reset/complete", {
    email: "alice@example.com", challengeToken: "T".repeat(43), newPassword: "SecurePass123!",
  }));
  assert.equal(boundary.status, 200);
  assert.equal(resetCompleteCalls.length, 1);
});
