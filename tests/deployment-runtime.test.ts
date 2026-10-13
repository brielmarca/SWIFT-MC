import assert from "node:assert/strict";
import test from "node:test";

test("unused order/payment modules load without a database and fail safely when called", async () => {
  const saved = Object.fromEntries(["DATABASE_URL", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_WEBHOOK_SECRET"].map((key) => [key, process.env[key]]));
  for (const key of Object.keys(saved)) delete process.env[key];
  try {
    const { POST: order } = await import("@/app/api/orders/route");
    const { POST: payment } = await import("@/app/api/orders/[orderNumber]/payment/route");
    const { POST: webhook } = await import("@/app/api/webhooks/mercadopago/route");
    const orderResponse = await order(new Request("https://swift.example/api/orders", { method: "POST" }));
    assert.equal(orderResponse.status, 400);
    const response = await payment(new Request("https://swift.example/api/orders/SWIFT-20261012-ABCDEF0123/payment", {
      method: "POST", headers: { Authorization: `Bearer ${"a".repeat(32)}` },
    }), { params: Promise.resolve({ orderNumber: "SWIFT-20261012-ABCDEF0123" }) });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).error, "Payment service is temporarily unavailable.");
    const webhookResponse = await webhook(new Request("https://swift.example/api/webhooks/mercadopago", { method: "POST" }));
    assert.equal(webhookResponse.status, 200);
    assert.deepEqual(await webhookResponse.json(), { received: true });
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
