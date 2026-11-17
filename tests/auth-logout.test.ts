import assert from "node:assert/strict";
import test, { beforeEach, mock } from "node:test";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

const sessionToken = "S".repeat(43);
const csrfToken = "C".repeat(43);
let revoked: string[] = [];
let validations = 0;
let allowed = true;
const env = {
  APP_URL: "https://swiftmc.example",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://unused.invalid/test" },
  AUTH_RATE_LIMIT: { async limit() { return { success: allowed }; } },
};
const services = {
  sessionService: {
    async validateSession({ token }: { token: string }) {
      validations++;
      return token === sessionToken ? { ok: true, session: { id: "session-1" } } : { ok: false };
    },
    async revokeSession(id: string) { revoked.push(id); },
  },
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
mock.module("@/lib/auth-api/auth-stack", { namedExports: {
  withAuthServices: async (_env: unknown, callback: (value: typeof services) => unknown) => callback(services),
} });
const { POST } = await import("@/app/(auth)/api/logout/route");

beforeEach(() => { revoked = []; validations = 0; allowed = true; });

function request(overrides: Record<string, string | null | undefined> = {}) {
  const headers = new Headers({
    origin: env.APP_URL,
    "sec-fetch-site": "same-origin",
    "cf-connecting-ip": "192.0.2.1",
    cookie: `__Host-swiftmc_session=${sessionToken}; __Host-swiftmc_csrf=${csrfToken}`,
    "x-csrf-token": csrfToken,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) headers.delete(key);
    else headers.set(key, value);
  }
  return new Request(`${env.APP_URL}/api/logout`, { method: "POST", headers });
}

test("logout revokes the session and independently clears both cookies", async () => {
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.deepEqual(revoked, ["session-1"]);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^__Host-swiftmc_session=;/);
  assert.match(cookies[0], /HttpOnly/);
  assert.match(cookies[1], /^__Host-swiftmc_csrf=;/);
  for (const cookie of cookies) {
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /Path=\//);
  }
});

for (const [name, overrides] of Object.entries({
  "missing header": { "x-csrf-token": null },
  "missing cookie": { cookie: `__Host-swiftmc_session=${sessionToken}` },
  "mismatched token": { "x-csrf-token": "wrong-token" },
  "empty token": { "x-csrf-token": "" },
})) {
  test(`logout rejects ${name} before touching the session`, async () => {
    const response = await POST(request(overrides));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "CSRF_REJECTED");
    assert.equal(validations, 0);
    assert.deepEqual(revoked, []);
    assert.equal(response.headers.get("set-cookie"), null);
  });
}

test("logout preserves origin, Fetch Metadata, and rate-limit protection", async () => {
  for (const overrides of [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }]) {
    assert.equal((await POST(request(overrides))).status, 403);
  }
  allowed = false;
  assert.equal((await POST(request())).status, 429);
  assert.equal(validations, 0);
  assert.deepEqual(revoked, []);
});

test("logout with an expired session still clears both cookies", async () => {
  const response = await POST(request({ cookie: `__Host-swiftmc_session=expired; __Host-swiftmc_csrf=${csrfToken}` }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.deepEqual(revoked, []);
});

test("browser CSRF reader uses only the exact existing cookie name", () => {
  assert.equal(extractCsrfTokenFromCookie(), null);
  const original = Object.getOwnPropertyDescriptor(globalThis, "document");
  try {
    for (const [cookie, expected] of [
      ["", null],
      ["other_csrf=wrong; __Host-swiftmc_csrf_extra=wrong", null],
      [`other=value; __Host-swiftmc_csrf=${csrfToken}`, csrfToken],
      ["__Host-swiftmc_csrf=token=padding", "token=padding"],
    ]) {
      Object.defineProperty(globalThis, "document", { configurable: true, value: { cookie } });
      assert.equal(extractCsrfTokenFromCookie(), expected);
    }
  } finally {
    if (original) Object.defineProperty(globalThis, "document", original);
    else Reflect.deleteProperty(globalThis, "document");
  }
});
