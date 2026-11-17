import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { requireTurnstile, withoutTurnstileToken } from "@/lib/auth/turnstile";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

const settings = {
  TURNSTILE_ENABLED: "true",
  TURNSTILE_SITE_KEY: "public-key",
  TURNSTILE_SECRET_KEY: "private-key",
  APP_URL: "https://swiftmc.com.br",
};
const request = new Request("https://swiftmc.com.br/api/register", {
  method: "POST",
  headers: { "cf-connecting-ip": "192.0.2.3" },
});
const body = { email: "tester@example.com", turnstileToken: "fresh-token" };

function fakeVerification(result: unknown, status = 200) {
  return new Response(JSON.stringify(result), { status, headers: { "content-type": "application/json" } });
}

test("does not remove unrelated strict-DTO fields while stripping only Turnstile transport metadata", () => {
  assert.deepEqual(withoutTurnstileToken({ email: "a@b.com", turnstileToken: "token", role: "ADMIN" }), { email: "a@b.com", role: "ADMIN" });
  assert.equal(withoutTurnstileToken(null), null);
  assert.deepEqual(withoutTurnstileToken(["invalid"]), ["invalid"]);
});

test("Turnstile is opt-in; missing keys fail closed when enforcement is enabled", async () => {
  assert.equal(await requireTurnstile(request, body, { ...settings, TURNSTILE_ENABLED: "false" }, ["register"]), null);
  const bad = await requireTurnstile(request, body, { ...settings, TURNSTILE_SECRET_KEY: "" }, ["register"]);
  assert.equal(bad?.status, 503);
  assert.ok(bad);
  assert.equal((await bad.json()).error.code, "CAPTCHA_UNAVAILABLE");
});

test("missing and malformed tokens are rejected without outbound Siteverify calls", async () => {
  for (const token of [undefined, null, "", "X".repeat(2049), 123]) {
    const result = await requireTurnstile(request, { ...body, turnstileToken: token }, settings, ["register"]);
    assert.equal(result?.status, 403);
    assert.ok(result);
    assert.equal((await result.json()).error.code, "CAPTCHA_REQUIRED");
  }
});

test("Siteverify success requires action and exact host, sends secret server-side", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    assert.equal(input, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(init?.method, "POST");
    const params = new URLSearchParams(init?.body as URLSearchParams);
    assert.equal(params.get("secret"), "private-key");
    assert.equal(params.get("response"), "fresh-token");
    assert.equal(params.get("remoteip"), "192.0.2.3");
    return fakeVerification({ success: true, action: "register", hostname: "swiftmc.com.br" });
  };
  try {
    assert.equal(await requireTurnstile(request, body, settings, ["register"]), null);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test("forged action, wrong hostname, and unsuccessful Siteverify are denied", async () => {
  const original = globalThis.fetch;
  try {
    for (const result of [
      { success: true, action: "login", hostname: "swiftmc.com.br" },
      { success: true, action: "register", hostname: "evil.example" },
      { success: false, action: "register", hostname: "swiftmc.com.br" },
      { success: true, hostname: "swiftmc.com.br" },
    ]) {
      globalThis.fetch = async () => fakeVerification(result);
      const reply = await requireTurnstile(request, body, settings, ["register"]);
      assert.equal(reply?.status, 403);
      assert.ok(reply);
      assert.equal((await reply.json()).error.code, "CAPTCHA_FAILED");
    }
  } finally { globalThis.fetch = original; }
});

test("Siteverify downtime and non-200 replies fail closed", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("network offline"); };
    assert.equal((await requireTurnstile(request, body, settings, ["register"]))?.status, 503);
    globalThis.fetch = async () => fakeVerification({}, 500);
    assert.equal((await requireTurnstile(request, body, settings, ["register"]))?.status, 503);
  } finally { globalThis.fetch = original; }
});

test("always-pass test secrets cannot be enabled in production", async () => {
  const result = await requireTurnstile(request, body, {
    ...settings, APP_ENV: "production", TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  }, ["register"]);
  assert.equal(result?.status, 503);
});

const env: Partial<AuthBindings> & { APP_URL: string } = {
  APP_URL: "https://swiftmc.com.br",
  AUTH_HYPERDRIVE: { connectionString: "postgresql://localhost/no-connection-needed" },
  AUTH_RATE_LIMIT: { async limit() { return { success: true }; } },
  TURNSTILE_ENABLED: "true",
  TURNSTILE_SITE_KEY: "public-key",
  TURNSTILE_SECRET_KEY: "private-key",
};
mock.module("@/lib/auth-api/get-env", { namedExports: { getWorkersEnv: async () => env } });
const register = await import("@/app/(auth)/api/register/route");
const login = await import("@/app/(auth)/api/login/route");
const forgot = await import("@/app/(auth)/api/password-reset/request/route");

function csrfRequest(path: string, input: object) {
  const csrf = "C".repeat(43);
  return new Request("https://swiftmc.com.br" + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://swiftmc.com.br",
      "sec-fetch-site": "same-origin",
      cookie: "__Host-swiftmc_csrf=" + csrf,
      "x-csrf-token": csrf,
    },
    body: JSON.stringify(input),
  });
}

test("auth APIs reject direct bot POSTs without Turnstile even with valid CSRF and rate limit", async () => {
  const cases = [
    ["/api/register", register.POST, { email: "tester@example.com" }],
    ["/api/login", login.POST, { email: "tester@example.com", password: "password123" }],
    ["/api/password-reset/request", forgot.POST, { email: "tester@example.com" }],
  ] as const;
  for (const [path, handler, input] of cases) {
    const response = await handler(csrfRequest(path, input));
    assert.equal(response.status, 403, path);
    assert.equal((await response.json()).error.code, "CAPTCHA_REQUIRED");
  }
});

test("extra Turnstile field reaches captcha validation without relaxing strict DTOs", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => fakeVerification({ success: false });
  try {
    const response = await register.POST(csrfRequest("/api/register", {
      email: "tester@example.com", turnstileToken: "invalid",
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, "CAPTCHA_FAILED");
  } finally { globalThis.fetch = original; }
});
