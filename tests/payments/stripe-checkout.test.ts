import assert from "node:assert/strict";
import test, { after } from "node:test";
import { OrderStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import type { StripeCheckoutClient } from "@/lib/payments/stripe-checkout";
import { StripeUnavailableError } from "@/lib/payments/stripe-checkout";
import { OrderNotPayableError, startStripeCheckout } from "@/lib/payments/stripe-checkout";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const createdOrderIds: string[] = [];
const appUrl = new URL("https://swift.example");

after(async () => {
  if (!db) return;
  if (createdOrderIds.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await db.$disconnect();
});

async function createPersistedOrder(overrides: Partial<{
  status: OrderStatus;
  expiresAt: Date;
  totalCents: number;
  currency: string;
  rankDuration: string;
}> = {}) {
  assert.ok(db);
  const order = await db.order.create({
    data: {
      publicToken: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
      orderNumber: `SWIFT-20261106-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      status: overrides.status ?? OrderStatus.PENDING_PAYMENT,
      rankSlug: "swift",
      rankName: "Swift",
      rankDuration: overrides.rankDuration ?? "Mensal",
      minecraftUsername: "StripePlayer",
      email: "stripe@example.com",
      currency: overrides.currency ?? "BRL",
      subtotalCents: overrides.totalCents ?? 1990,
      discountCents: 0,
      totalCents: overrides.totalCents ?? 1990,
      checkoutIdempotencyKey: crypto.randomUUID(),
      expiresAt: overrides.expiresAt ?? new Date("2026-11-07T00:00:00.000Z"),
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

function successfulCheckoutSession(
  calls: Array<{ body: URLSearchParams; key: string }>,
  providerSessionId = `cs_${crypto.randomUUID()}`,
): StripeCheckoutClient {
  return {
    async createCheckoutSession(request, key) {
      calls.push({ body: request as unknown as URLSearchParams, key });
      return {
        providerOrderId: providerSessionId,
        checkoutUrl: `https://checkout.stripe.com/pay/${providerSessionId}`,
        providerStatus: "open",
      };
    },
  };
}

test("creates a Stripe Checkout Session from persisted authoritative values", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ body: URLSearchParams; key: string }> = [];

  const checkout = await startStripeCheckout(
    db,
    successfulCheckoutSession(calls, "cs_test_001"),
    { orderNumber: order.orderNumber, orderToken: order.publicToken },
    { appUrl, now: new Date("2026-11-06T12:00:00.000Z") },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].key.match(/^[0-9a-f-]{36}$/) !== null, true);
  const body = calls[0].body;
  assert.equal(body.get("mode"), "subscription");
  assert.equal(body.get("client_reference_id"), order.orderNumber);
  assert.equal(body.get("metadata[orderNumber]"), order.orderNumber);
  assert.equal(body.get("metadata[rankSlug]"), "swift");
  assert.equal(body.get("metadata[minecraftUsername]"), "StripePlayer");
  assert.equal(body.get("success_url"), "https://swift.example/checkout/return/success");
  assert.equal(body.get("cancel_url"), "https://swift.example/checkout/return/cancel");
  assert.equal(body.get("line_items[0][price_data][currency]"), "brl");
  assert.equal(body.get("line_items[0][price_data][product_data][name]"), "Rank Swift");
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "1990");
  assert.equal(body.get("line_items[0][quantity]"), "1");
  assert.equal(body.get("line_items[0][price_data][recurring][interval]"), "month");
  assert.equal(checkout.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_001");
});

test("creates a one-time payment Checkout Session for Coins (non-subscription rank)", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder({ rankDuration: "Vitalício" });
  const calls: Array<{ body: URLSearchParams; key: string }> = [];

  await startStripeCheckout(
    db,
    successfulCheckoutSession(calls),
    { orderNumber: order.orderNumber, orderToken: order.publicToken },
    { appUrl, now: new Date("2026-11-06T12:00:00.000Z") },
  );

  assert.equal(calls.length, 1);
  const body = calls[0].body;
  assert.equal(body.get("mode"), "payment");
  assert.equal(body.get("line_items[0][price_data][recurring][interval]"), null);
});

test("rejects expired and non-payable orders before calling Stripe", databaseOptions, async () => {
  assert.ok(db);
  const expired = await createPersistedOrder({ expiresAt: new Date("2026-11-06T11:00:00.000Z") });
  const paid = await createPersistedOrder({ status: OrderStatus.PAID });
  let callCount = 0;
  const provider: StripeCheckoutClient = {
    async createCheckoutSession() { callCount += 1; throw new Error("must not be called"); },
  };

  await assert.rejects(
    startStripeCheckout(db, provider, { orderNumber: expired.orderNumber, orderToken: expired.publicToken }, { appUrl, now: new Date("2026-11-06T12:00:00.000Z") }),
    OrderNotPayableError,
  );
  await assert.rejects(
    startStripeCheckout(db, provider, { orderNumber: paid.orderNumber, orderToken: paid.publicToken }, { appUrl, now: new Date("2026-11-06T12:00:00.000Z") }),
    OrderNotPayableError,
  );
  assert.equal(callCount, 0);
});

test("Stripe unavailability throws StripeUnavailableError", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const provider: StripeCheckoutClient = {
    async createCheckoutSession() { throw new StripeUnavailableError(); },
  };

  await assert.rejects(
    startStripeCheckout(db, provider, { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: new Date("2026-11-06T12:00:00.000Z") }),
    StripeUnavailableError,
  );
});
