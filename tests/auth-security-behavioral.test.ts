import assert from "node:assert/strict";
import test, { mock, beforeEach } from "node:test";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

// Mock only infrastructure boundaries; execute real routes, middleware, DTOs,
// rate-limit key derivation and cookie serialization. No external services.
const user = { id: "alice", emailNormalized: "alice@example.com", role: "USER", status: "ACTIVE", authVersion: 1, displayName: "Alice", createdAt: new Date(), emailVerifiedAt: new Date() };
const rawToken = "S".repeat(43);
let loginCalls = 0;
let writes = 0;
let keys: string[] = [];
let allow = true;
let failLimiter = false;
let loginOk = false;
const env: Partial<AuthBindings> & { APP_URL: string } = {
  APP_URL: "https://swiftmc.example",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://unused.invalid/test" },
  AUTH_RATE_LIMIT: { async limit({ key }: { key: string }) {
    keys.push(key);
    if (failLimiter) throw new Error("offline");
    return { success: allow };
  } },
};
const orders = [
  { id: "1", orderNumber: "OWN", userId: "alice", email: user.emailNormalized, payments: [], fulfillment: null },
  { id: "2", orderNumber: "OTHER", userId: "bob", email: "bob@example.com", payments: [], fulfillment: null },
];
type Where = { userId?: string; orderNumber?: string };
const filter = (where: Where) => orders.filter(o => (!where.userId || o.userId === where.userId) && (!where.orderNumber || o.orderNumber === where.orderNumber));
const prisma = {
  order: {
    async findFirst({ where }: { where: Where }) { return filter(where)[0] ?? null; },
    async findMany({ where }: { where: Where }) { return filter(where); },
    async count({ where }: { where: Where }) { return filter(where).length; },
  },
  user: {
    async findUnique({ where }: { where: { id: string } }) { assert.equal(where.id, user.id); return user; },
    async update({ where }: { where: { id: string } }) { assert.equal(where.id, user.id); writes++; return user; },
  },
};
const services = {
  registrationService: { async requestRegistration() {
    return { ok: true, acknowledgement: "Check your email." };
  } },
  loginService: { async login() {
    loginCalls++;
    return loginOk ? { ok: true, user, rawToken, session: { absoluteExpiresAt: new Date(Date.now() + 60_000) } } : { ok: false, code: "LOGIN_FAILED" };
  } },
  sessionService: { async validateSession({ token }: { token: string }) {
    return token === rawToken ? { ok: true, user, session: { id: "session-a" } } : { ok: false, code: "INVALID_SESSION" };
  } },
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/auth-api/verification-transaction", { namedExports: {
  withVerificationTransaction: async (_env: unknown, _email: string, callback: (value: typeof services) => unknown) => callback(services),
} });
mock.module("@/lib/auth-api/auth-stack", { namedExports: {
  withAuthServices: async (_env: unknown, callback: (value: typeof services) => unknown) => callback(services),
  withAuthTransaction: async () => { throw new Error("unexpected transaction"); },
} });
mock.module("@/lib/auth-infrastructure/prisma", { namedExports: {
  withAuthPrisma: async (_env: unknown, callback: (value: typeof prisma) => unknown) => callback(prisma),
} });
const login = await import("@/app/(auth)/api/login/route");
const profile = await import("@/app/api/user/profile/route");
const list = await import("@/app/api/user/orders/route");
const detail = await import("@/app/api/user/orders/[orderNumber]/route");
const verify = await import("@/app/(auth)/api/verify-email/route");
const register = await import("@/app/(auth)/api/register/route");

beforeEach(() => { loginCalls = 0; writes = 0; keys = []; allow = true; failLimiter = false; loginOk = false; });
function request(path: string, body?: object, overrides: Record<string, string> = {}) {
  return new Request(`https://swiftmc.example${path}`, {
    method: body ? "POST" : "GET",
    headers: { origin: "https://swiftmc.example", "content-type": "application/json", "sec-fetch-site": "same-origin",
      cookie: `__Host-swiftmc_session=${rawToken}; __Host-swiftmc_csrf=csrf-token`, "x-csrf-token": "csrf-token", ...overrides },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const credentials = { email: "alice@example.com", password: "wrong-password" };

test("login rejects missing/mismatched CSRF and cross-origin requests before credential verification", async () => {
  const rejectedHeaders: Record<string, string>[] = [
    { "x-csrf-token": "" }, { cookie: "" }, { "x-csrf-token": "wrong" },
    { origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of rejectedHeaders) {
    const response = await login.POST(request("/api/login", credentials, headers));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  assert.equal(loginCalls, 0);
  assert.equal(keys.length, 0);
  assert.equal((await login.POST(request("/api/login", credentials))).status, 401);
  assert.equal(loginCalls, 1, "valid CSRF reaches credential verification");
});

test("login failures have identical HTTP bodies, statuses and no cookies", async () => {
  const responses = [];
  for (const email of ["unknown@example.com", "alice@example.com", "locked@example.com"]) {
    const response = await login.POST(request("/api/login", { ...credentials, email }));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
    responses.push(await response.json());
  }
  assert.deepEqual(responses[0], responses[1]);
  assert.deepEqual(responses[1], responses[2]);
});

test("login keeps session HttpOnly and out of JSON, with a separate CSRF cookie", async () => {
  loginOk = true;
  const response = await login.POST(request("/api/login", credentials));
  assert.equal(response.status, 200);
  assert.ok(!(await response.text()).includes(rawToken));
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /__Host-swiftmc_session=.*;.*HttpOnly/);
  assert.match(cookies[0], /Secure/);
  assert.match(cookies[1], /__Host-swiftmc_csrf=/);
  assert.ok(!cookies[1].includes(rawToken));
});

test("email rate limit cannot be bypassed with casing, whitespace, rotated or missing IP", async () => {
  allow = false;
  const variants: Record<string, string>[] = [{}, { "cf-connecting-ip": "192.0.2.1" }, { "cf-connecting-ip": "192.0.2.2", "x-forwarded-for": "203.0.113.1" }];
  for (const headers of variants) {
    for (const email of ["alice@example.com", " ALICE@Example.COM "]) {
      const response = await login.POST(request("/api/login", { ...credentials, email }, headers));
      assert.equal(response.status, 429);
      assert.equal(response.headers.get("retry-after"), "60");
    }
  }
  assert.equal(new Set(keys).size, 1);
  assert.equal(loginCalls, 0);
  failLimiter = true;
  assert.equal((await login.POST(request("/api/login", credentials))).status, 429);
});

test("authenticated profile mutations require CSRF and reject identity/role injection", async () => {
  assert.equal((await profile.POST(request("/api/user/profile", { displayName: "New" }, { "x-csrf-token": "" }))).status, 403);
  assert.equal((await profile.POST(request("/api/user/profile", { displayName: "New", userId: "bob", role: "ADMIN" }))).status, 400);
  assert.equal(writes, 0);
  assert.equal((await profile.POST(request("/api/user/profile?userId=bob", { displayName: "New" }))).status, 200);
  assert.equal(writes, 1);
});

test("IDOR: authenticated users see only their own orders and profile", async () => {
  const own = await detail.GET(request("/api/user/orders/OWN"), { params: Promise.resolve({ orderNumber: "OWN" }) });
  assert.equal(own.status, 200);
  const other = await detail.GET(request("/api/user/orders/OTHER?userId=bob"), { params: Promise.resolve({ orderNumber: "OTHER" }) });
  const missing = await detail.GET(request("/api/user/orders/MISSING"), { params: Promise.resolve({ orderNumber: "MISSING" }) });
  assert.equal(other.status, 404);
  assert.equal(missing.status, 404);
  assert.deepEqual(await other.json(), await missing.json());
  const response = await list.GET(request("/api/user/orders?page=1&pageSize=20&userId=bob"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.orders.map((o: { orderNumber: string }) => o.orderNumber), ["OWN"]);
  assert.equal(body.pagination.total, 1);
  const account = await profile.GET(request("/api/user/profile?userId=bob"));
  assert.equal((await account.json()).user.id, "alice");
});

test("verify-email rate key cannot be rotated using an attacker-controlled email cookie", async () => {
  allow = false;
  const body = { email: "alice@example.com", password: "Strong-password123!", displayName: "Alice", challengeToken: "T".repeat(43) };
  for (const emailCookie of ["one", "two"]) {
    const response = await verify.POST(request("/api/verify-email", body, { cookie: `__Host-swiftmc_csrf=csrf-token; email=${emailCookie}` }));
    assert.equal(response.status, 429);
  }
  assert.equal(new Set(keys).size, 1);
});

test("protected routes cannot bypass rate limiting by omitting trusted IP or spoofing forwarding headers", async () => {
  allow = false;
  for (const headers of [{}, { "x-forwarded-for": "192.0.2.1" }, { "x-forwarded-for": "192.0.2.2" }]) {
    const response = await profile.POST(request("/api/user/profile", { displayName: "New" }, headers as Record<string, string>));
    assert.equal(response.status, 429);
  }
  assert.equal(writes, 0);
  assert.equal(new Set(keys).size, 1);
  const binding = env.AUTH_RATE_LIMIT;
  try {
    delete env.AUTH_RATE_LIMIT;
    assert.equal((await profile.GET(request("/api/user/profile"))).status, 429);
    assert.equal((await login.POST(request("/api/login", credentials))).status, 429);
  } finally {
    env.AUTH_RATE_LIMIT = binding;
  }
});

test("registration acknowledgement does not expose domain tokens or create a session", async () => {
  const response = await register.POST(request("/api/register", { email: "alice@example.com", password: "Strong-password123!", displayName: "Alice" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, acknowledgement: "Check your email." });
  assert.equal(response.headers.get("set-cookie"), null);
});
