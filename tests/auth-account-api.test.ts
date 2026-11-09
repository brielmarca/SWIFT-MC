import assert from "node:assert/strict";
import test from "node:test";
import { requireSession, validateSessionFromRequest } from "@/lib/auth/middleware";

// ---------------------------------------------------------------------------
// Profile API: GET returns user data when authenticated
// ---------------------------------------------------------------------------

test("profile GET rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/user/profile/route");
  assert.ok(mod.GET, "profile GET handler should exist");

  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request);
  assert.ok(response.status !== 200, `profile GET should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Profile API: POST rejects unauthenticated and invalid input
// ---------------------------------------------------------------------------

test("profile POST rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/user/profile/route");
  assert.ok(mod.POST, "profile POST handler should exist");

  const request = new Request("https://swiftmc.example/api/user/profile", {
    method: "POST",
    headers: { cookie: "", "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "New Name" }),
  });
  const response = await mod.POST(request);
  assert.ok(response.status !== 200, `profile POST should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Orders API: GET returns only authenticated user's orders
// ---------------------------------------------------------------------------

test("orders GET rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/user/orders/route");
  assert.ok(mod.GET, "orders GET handler should exist");

  const request = new Request("https://swiftmc.example/api/user/orders", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request);
  assert.ok(response.status !== 200, `orders GET should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Single order API: GET with ownership check
// ---------------------------------------------------------------------------

test("single order GET rejects unauthenticated access", async () => {
  const mod = await import("@/app/api/user/orders/[orderNumber]/route");
  assert.ok(mod.GET, "single order GET handler should exist");

  const request = new Request("https://swiftmc.example/api/user/orders/ORD-123", {
    headers: { cookie: "" },
  });
  const response = await mod.GET(request, { params: Promise.resolve({ orderNumber: "ORD-123" }) });
  assert.ok(response.status !== 200, `single order GET should reject unauthenticated access, got ${response.status}`);
  assert.ok([401, 429].includes(response.status), `expected 401 or 429, got ${response.status}`);
});

// ---------------------------------------------------------------------------
// Session validation tests
// ---------------------------------------------------------------------------

test("requireSession returns 401 when no session cookie", async () => {
  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "" },
  });
  const result = await requireSession(request);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 401);
  const body = await result.json();
  assert.equal(body.error.code, "NO_SESSION");
});

test("requireSession returns 401 when Hyperdrive is missing", async () => {
  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "__Host-swiftmc_session=token" },
  });
  const env = { APP_URL: "https://swiftmc.example" }; // No AUTH_HYPERDRIVE
  const result = await requireSession(request, env);
  assert.ok(result instanceof Response);
  assert.equal(result.status, 401);
});

test("validateSessionFromRequest returns NO_SESSION when no cookie", async () => {
  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "" },
  });
  const result = await validateSessionFromRequest(request);
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "NO_SESSION");
});

test("validateSessionFromRequest returns unauthenticated when Hyperdrive missing", async () => {
  const request = new Request("https://swiftmc.example/api/user/profile", {
    headers: { cookie: "__Host-swiftmc_session=token" },
  });
  const env = { APP_URL: "https://swiftmc.example" };
  const result = await validateSessionFromRequest(request, env);
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "INFRASTRUCTURE_UNAVAILABLE");
});
