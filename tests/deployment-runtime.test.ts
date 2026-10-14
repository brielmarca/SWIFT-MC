import assert from "node:assert/strict";
import test from "node:test";

test("order, payment and webhook routes stay blocked even with credentials configured", async () => {
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
    for (const configured of [false, true]) {
      for (const key of keys) {
        if (configured) process.env[key] = "demo-test-placeholder";
        else delete process.env[key];
      }
      for (const { POST } of routes) {
        const response = POST();
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        assert.equal((await response.json()).error, "DEMO_ONLY");
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
