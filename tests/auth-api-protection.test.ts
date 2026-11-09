import assert from "node:assert/strict";
import test from "node:test";
import { requireSession, validateSessionFromRequest } from "@/lib/auth/middleware";

// ---------------------------------------------------------------------------
// API route protection tests (direct route handler calls)
// ---------------------------------------------------------------------------

test("orders API route rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/orders/route");
  assert.ok(mod.POST, "orders POST handler should exist");

  const request = new Request("https://swiftmc.example/api/orders", {
    method: "POST",
    headers: { cookie: "" },
  });
  const response = await mod.POST(request);
  assert.ok(response.status !== 200, `orders route should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

test("payment API route rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/orders/[orderNumber]/payment/route");
  assert.ok(mod.POST, "payment POST handler should exist");

  const request = new Request("https://swiftmc.example/api/orders/123/payment", {
    method: "POST",
    headers: { cookie: "" },
  });
  const response = await mod.POST(request);
  assert.ok(response.status !== 200, `payment route should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Webhook route stays public (no auth required)
// ---------------------------------------------------------------------------

test("mercadopago webhook route stays publicly accessible", async () => {
  const mod = await import("@/app/api/webhooks/mercadopago/route");
  assert.ok(mod.POST, "webhook POST handler should exist");

  const request = new Request("https://swiftmc.example/api/webhooks/mercadopago", {
    method: "POST",
    headers: { cookie: "" },
  });
  const response = await mod.POST(request);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.error.code, "PURCHASES_DISABLED");
});

// ---------------------------------------------------------------------------
// requireSession tests (direct middleware testing)
// ---------------------------------------------------------------------------

test("requireSession returns 401 when no session cookie", async () => {
  const request = new Request("https://swiftmc.example/api/orders", {
    headers: { cookie: "" },
  });
  const result = await requireSession(request);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 401);
  const body = await result.json();
  assert.equal(body.error.code, "NO_SESSION");
});

test("requireSession returns 401 when Hyperdrive is missing", async () => {
  const request = new Request("https://swiftmc.example/api/orders", {
    headers: { cookie: "__Host-swiftmc_session=token" },
  });
  const env = { APP_URL: "https://swiftmc.example" }; // No AUTH_HYPERDRIVE
  const result = await requireSession(request, env);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 401);
});

test("requireSession returns 429 when rate limiter rejects", async () => {
  const request = new Request("https://swiftmc.example/api/orders", {
    headers: { cookie: "__Host-swiftmc_session=token", "cf-connecting-ip": "1.2.3.4" },
  });
  const env = {
    AUTH_HYPERDRIVE: { connectionString: "postgresql://localhost/test" },
    APP_URL: "https://swiftmc.example",
    // No AUTH_RATE_LIMIT -> RejectingRateLimiter rejects all
  };
  const result = await requireSession(request, env);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 429);
});

test("validateSessionFromRequest returns NO_SESSION when no cookie", async () => {
  const request = new Request("https://swiftmc.example/api/orders", {
    headers: { cookie: "" },
  });
  const result = await validateSessionFromRequest(request);
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "NO_SESSION");
});

test("validateSessionFromRequest returns unauthenticated when Hyperdrive missing", async () => {
  const request = new Request("https://swiftmc.example/api/orders", {
    headers: { cookie: "__Host-swiftmc_session=token" },
  });
  const env = { APP_URL: "https://swiftmc.example" };
  const result = await validateSessionFromRequest(request, env);
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "INFRASTRUCTURE_UNAVAILABLE");
});
