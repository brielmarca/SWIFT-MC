import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { parseStripeWebhookEvent, reconcileStripeWebhook, verifyStripeSignature } from "@/lib/payments/stripe-webhook";
import { createStripeClient } from "@/lib/payments/stripe";
import type { PrismaClient } from "@prisma/client";
import { POST } from "@/app/api/webhooks/stripe/route";

const secret = "whsec_unit_test_only";
const body = JSON.stringify({ id: "evt_test123", type: "checkout.session.completed", data: { object: { id: "cs_test_123" } } });
function metadata(timestamp: string, payload = body) {
  return { eventId: "evt_test123", timestamp, signature: createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex") };
}

test("production route rejects stale or altered signatures before database access", async () => {
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_SECRET_KEY = "sk_test_unit_only";
  try {
    for (const [timestamp, payload] of [["1742505638683", body], [String(Math.floor(Date.now() / 1000)), `${body} `]]) {
      const signed = metadata(timestamp);
      const response = await POST(new Request("https://swift.example/api/webhooks/stripe", {
        method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signed.signature}` }, body: payload,
      }));
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error, "INVALID_SIGNATURE");
    }
    // A fresh signed malformed event reaches payload validation without login,
    // Origin or CSRF headers. It cannot reach reconciliation or the database.
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signed = metadata(timestamp, "{}");
    const response = await POST(new Request("https://swift.example/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": `t=${timestamp},v1=${signed.signature}` }, body: "{}",
    }));
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_EVENT_PAYLOAD");
  } finally {
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  }
});

test("Stripe signatures require fresh Unix seconds and the exact signed body", async () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(await verifyStripeSignature(body, metadata(String(now)), secret), true);
  for (const timestamp of ["1742505638683", String(Date.now()), String(now - 600), String(now + 600)]) {
    assert.equal(await verifyStripeSignature(body, metadata(timestamp), secret), false);
  }
  assert.equal(await verifyStripeSignature(`${body} `, metadata(String(now)), secret), false);
  assert.equal(await verifyStripeSignature(body, metadata(String(now)), "whsec_wrong_secret"), false);
});

test("Stripe event IDs accept provider underscores but reject path/control characters", () => {
  assert.ok(parseStripeWebhookEvent(JSON.parse(body)));
  for (const id of ["evt/123", "../evt", "evt\n123", "", "x".repeat(256)]) {
    assert.equal(parseStripeWebhookEvent({ ...JSON.parse(body), id }), null);
  }
});

test("Stripe reconciliation fetches the exact v1 resource URL and preserves provider values", async () => {
  const responses = [
    { id: "cs_test_123", object: "checkout.session", mode: "payment", status: "complete", payment_status: "paid", amount_total: 1990, currency: "brl" },
    { id: "in_test123", status: "open", amount_paid: 0, amount_due: 1990, currency: "brl" },
    { id: "sub_test123", status: "active", customer: "cus_test123" },
    { id: "ch_test123", status: "succeeded", amount: 1990, currency: "brl", refunded: true, metadata: { orderNumber: "SWIFT-test" } },
  ];
  const paths = ["checkout/sessions/cs_test_123", "invoices/in_test123", "subscriptions/sub_test123", "charges/ch_test123"];
  let calls = 0;
  const client = createStripeClient("test-key", async (url, init) => {
    assert.equal(String(url), `https://api.stripe.com/v1/${paths[calls]}`);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-key");
    return Response.json(responses[calls++]);
  });
  assert.equal((await client.getCheckoutSession("cs_test_123"))?.amount_total, 1990);
  assert.equal((await client.getInvoice("in_test123"))?.amount_due, 1990);
  assert.equal((await client.getSubscription("sub_test123"))?.status, "active");
  assert.equal((await client.getCharge("ch_test123"))?.metadata.orderNumber, "SWIFT-test");
  assert.equal(calls, 4);
  await assert.rejects(client.getCharge("../ch_bad"));
  assert.equal(calls, 4);
});

test("refund reconciliation preserves exact cents, normalizes currency, and rejects real mismatches", async () => {
  const cases = [
    { amount: 1990, currency: "brl", mismatch: null as null | "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH" },
    { amount: 2000, currency: "brl", mismatch: "AMOUNT_MISMATCH" as const },
    { amount: 1990, currency: "usd", mismatch: "CURRENCY_MISMATCH" as const },
  ];
  for (const scenario of cases) {
    const paymentWrites: Array<Record<string, unknown>> = [];
    const eventWrites: Array<Record<string, unknown>> = [];
    const orderWrites: Array<Record<string, unknown>> = [];
    const payment = {
      id: "payment",
      orderId: "order",
      provider: "STRIPE",
      status: "APPROVED",
      providerOrderId: "cs_test",
      providerPaymentId: "pi_test",
      amountCents: 1990,
      currency: "BRL",
      approvedAt: null,
      order: { id: "order", orderNumber: "SWIFT-test", status: "PAID", totalCents: 1990, paidAt: null },
    };
    const store = {
      $queryRaw: async () => [],
      paymentEvent: {
        findUnique: async () => null,
        create: async () => ({}),
        update: async ({ data }: { data: Record<string, unknown> }) => { eventWrites.push(data); },
      },
      payment: {
        findFirst: async () => payment,
        findUnique: async () => payment,
        update: async ({ data }: { data: Record<string, unknown> }) => { paymentWrites.push(data); },
      },
      order: { update: async ({ data }: { data: Record<string, unknown> }) => { orderWrites.push(data); } },
      fulfillment: { findUnique: async () => null },
      vipEntitlement: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
      bridgeDelivery: { updateMany: async () => ({ count: 0 }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(store),
    };
    const stripe = createStripeClient("test-key", async () => Response.json({
      id: "ch_test", status: "succeeded", amount: scenario.amount, currency: scenario.currency, refunded: true,
      payment_intent: "pi_test", metadata: { orderNumber: "SWIFT-test", paymentId: "payment" },
    }));
    const result = await reconcileStripeWebhook(store as unknown as PrismaClient, stripe,
      { id: "evt_test", type: "charge.refunded", data: { object: { id: "ch_test" } } }, metadata(String(Math.floor(Date.now() / 1000))));
    if (scenario.mismatch) {
      assert.equal(result, "ignored");
      assert.equal(paymentWrites.length, 0);
      assert.equal(eventWrites.at(-1)?.lastErrorCode, scenario.mismatch);
    } else {
      assert.equal(result, "processed");
      assert.equal(paymentWrites[0].amountCents, 1990);
      assert.equal(paymentWrites[0].currency, "BRL");
      assert.equal(paymentWrites[0].status, "REFUNDED");
      assert.equal(eventWrites.at(-1)?.status, "PROCESSED");
      assert.equal(orderWrites[0].status, "REFUNDED");
    }
  }
});

test("subscription and invoice events no longer reconcile a one-time order", async () => {
  const store = {
    $queryRaw: async () => [],
    paymentEvent: {
      findUnique: async () => null,
      create: async () => ({}),
      update: async () => undefined,
    },
    payment: { findFirst: async () => { throw new Error("must not query payments"); } },
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(store),
  };
  const stripe = createStripeClient("test-key", async () => { throw new Error("must not call Stripe"); });
  for (const type of ["invoice.paid", "invoice.payment_failed", "customer.subscription.updated", "customer.subscription.deleted"]) {
    const result = await reconcileStripeWebhook(store as unknown as PrismaClient, stripe,
      { id: `evt_${type}`, type, data: { object: { id: "in_test" } } }, metadata(String(Math.floor(Date.now() / 1000))));
    assert.equal(result, "ignored");
  }
});
