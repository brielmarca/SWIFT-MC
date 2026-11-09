import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("order and payment routes require authentication; webhook stays demo-blocked", async () => {
  const keys = ["DATABASE_URL", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Demo APIs must never contact a provider"); };
  try {
    const routes = await Promise.all([
      import("@/app/api/orders/route"),
      import("@/app/api/orders/[orderNumber]/payment/route"),
      import("@/app/api/webhooks/mercadopago/route"),
    ]);
    const [ordersRoute, paymentRoute, webhookRoute] = routes;
    for (const configured of [false, true]) {
      for (const key of keys) {
        if (configured) process.env[key] = "demo-test-placeholder";
        else delete process.env[key];
      }
      // Orders and payment routes require authentication; unauthenticated
      // access is rejected with 401 or 429 (rate limiter rejects all when
      // AUTH_RATE_LIMIT binding is absent).
      const ordersResponse = await ordersRoute.POST();
      assert.ok(ordersResponse.status !== 200, `orders route should reject unauthenticated access, got ${ordersResponse.status}`);
      assert.ok([401, 429].includes(ordersResponse.status), `expected 401 or 429, got ${ordersResponse.status}`);

      const paymentResponse = await paymentRoute.POST();
      assert.ok(paymentResponse.status !== 200, `payment route should reject unauthenticated access, got ${paymentResponse.status}`);
      assert.ok([401, 429].includes(paymentResponse.status), `expected 401 or 429, got ${paymentResponse.status}`);

      // Webhook route stays publicly accessible (signature-based, demo-blocked).
      const webhookResponse = await webhookRoute.POST(new Request("https://swiftmc.example/api/webhooks/mercadopago", { method: "POST" }));
      const wbody = await webhookResponse.json();
      assert.equal(webhookResponse.status, 503);
      assert.equal(wbody.error.code, "PURCHASES_DISABLED");
      if (webhookResponse.headers.get("Cache-Control")) assert.equal(webhookResponse.headers.get("Cache-Control"), "no-store");
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

// The Worker runtime never provides DATABASE_URL; only Hyperdrive does.
// A route that reintroduces getPrisma()/process.env would ship a 500/401
// failure that unit tests with a local DATABASE_URL cannot catch.
test("Stripe webhook and fulfillment routes reach the database only through Workers bindings", () => {
  const routes = [
    "app/api/webhooks/stripe/route.ts",
    "app/api/internal/fulfillments/process/route.ts",
  ];
  for (const route of routes) {
    const source = readFileSync(resolve(process.cwd(), route), "utf8");
    // Strip line comments so prose about process.env does not fail the check.
    const code = source.replace(/\/\/.*$/gm, "");
    assert.ok(!code.includes("@/lib/prisma"), `${route} must not import getPrisma`);
    assert.ok(!code.includes("process.env"), `${route} must not read process.env directly`);
    assert.ok(code.includes("getWorkersEnv"), `${route} must read Workers bindings`);
    assert.ok(code.includes("withAuthPrisma"), `${route} must reach the database through Hyperdrive`);
  }
});
