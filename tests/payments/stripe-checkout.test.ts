import assert from "node:assert/strict";
import test, { after } from "node:test";
import { OrderStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import type { StripeCheckoutClient, StripeCheckoutSessionRequest } from "@/lib/payments/stripe-checkout";
import {
  OrderNotFoundError,
  OrderNotPayableError,
  StripeUnavailableError,
  startStripeCheckout,
} from "@/lib/payments/stripe-checkout";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const createdOrderIds: string[] = [];
const createdUserIds: string[] = [];
const appUrl = new URL("https://swift.example");
const NOW = new Date("2026-11-06T12:00:00.000Z");

after(async () => {
  if (!db) return;
  if (createdOrderIds.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await db.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await db.$disconnect();
});

async function createPersistedOrder(overrides: Partial<{
  status: OrderStatus;
  expiresAt: Date;
  totalCents: number;
  currency: string;
  userId: string | null;
}> = {}) {
  assert.ok(db);
  const order = await db.order.create({
    data: {
      publicToken: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
      orderNumber: `SWIFT-20261106-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      status: overrides.status ?? OrderStatus.PENDING_PAYMENT,
      userId: overrides.userId ?? null,
      rankSlug: "swift",
      rankName: "Swift",
      rankDuration: "Mensal",
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
  calls: Array<{ request: StripeCheckoutSessionRequest; key: string }>,
  providerSessionId = `cs_${crypto.randomUUID()}`,
): StripeCheckoutClient {
  return {
    async createCheckoutSession(request, key) {
      calls.push({ request, key });
      return {
        providerOrderId: providerSessionId,
        checkoutUrl: `https://checkout.stripe.com/pay/${providerSessionId}`,
        providerStatus: "open",
      };
    },
  };
}

test("creates a one-time Stripe Checkout Session from persisted authoritative values", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ request: StripeCheckoutSessionRequest; key: string }> = [];

  const checkout = await startStripeCheckout(
    db,
    successfulCheckoutSession(calls, "cs_test_001"),
    { orderNumber: order.orderNumber, orderToken: order.publicToken },
    { appUrl, now: NOW },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0].key, /^[0-9a-f-]{36}$/);
  const request = calls[0].request;
  assert.equal(request.mode, "payment");
  assert.equal(request.clientReferenceId, order.orderNumber);
  assert.equal(request.metadata.orderNumber, order.orderNumber);
  assert.equal(request.metadata.rankSlug, "swift");
  assert.equal(request.metadata.minecraftUsername, "StripePlayer");
  assert.match(request.metadata.paymentId, /^c[a-z0-9]{24}$/);
  assert.equal(request.successUrl, `https://swift.example/checkout/return/success?order=${order.orderNumber}`);
  assert.equal(request.cancelUrl, `https://swift.example/checkout/return/cancel?order=${order.orderNumber}`);
  assert.equal(request.expiresAt, Math.floor(order.expiresAt.getTime() / 1000));
  assert.equal(request.lineItems.length, 1);
  assert.equal(request.lineItems[0].currency, "brl");
  assert.equal(request.lineItems[0].name, "Rank Swift");
  assert.equal(request.lineItems[0].unitAmountCents, 1990);
  assert.equal(request.lineItems[0].quantity, 1);
  assert.equal(request.lineItems[0].recurring, undefined);
  assert.equal(checkout.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_001");

  const payment = await db.payment.findUnique({ where: { providerIdempotencyKey: calls[0].key } });
  assert.ok(payment);
  assert.equal(payment.id, request.metadata.paymentId);
  assert.equal(payment.providerOrderId, "cs_test_001");
  assert.equal(payment.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_001");
  assert.equal(payment.amountCents, 1990);
  assert.equal(payment.currency, "BRL");
});

test("reuses a persisted checkout URL without calling Stripe again", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ request: StripeCheckoutSessionRequest; key: string }> = [];

  const first = await startStripeCheckout(
    db, successfulCheckoutSession(calls, "cs_test_reuse"), { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: NOW },
  );
  const second = await startStripeCheckout(
    db, successfulCheckoutSession(calls, "cs_test_other"), { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: NOW },
  );

  assert.equal(calls.length, 1);
  assert.equal(second.checkoutUrl, first.checkoutUrl);
});

test("scopes checkout to the authenticated owner", databaseOptions, async () => {
  assert.ok(db);
  const owner = await db.user.create({ data: { displayName: "Checkout owner" } });
  createdUserIds.push(owner.id);
  const order = await createPersistedOrder({ userId: owner.id });
  const calls: Array<{ request: StripeCheckoutSessionRequest; key: string }> = [];

  await assert.rejects(
    startStripeCheckout(db, successfulCheckoutSession(calls), { orderNumber: order.orderNumber, orderToken: order.publicToken, userId: "user-b" }, { appUrl, now: NOW }),
    OrderNotFoundError,
  );
  assert.equal(calls.length, 0);
});

test("rejects expired, nearly expired and non-payable orders before calling Stripe", databaseOptions, async () => {
  assert.ok(db);
  const expired = await createPersistedOrder({ expiresAt: new Date("2026-11-06T11:00:00.000Z") });
  const nearlyExpired = await createPersistedOrder({ expiresAt: new Date("2026-11-06T12:10:00.000Z") });
  const paid = await createPersistedOrder({ status: OrderStatus.PAID });
  await assert.rejects(createPersistedOrder({ currency: "USD" }), /Order_currency_brl/);
  let callCount = 0;
  const provider: StripeCheckoutClient = {
    async createCheckoutSession() { callCount += 1; throw new Error("must not be called"); },
  };

  for (const order of [expired, nearlyExpired, paid]) {
    await assert.rejects(
      startStripeCheckout(db, provider, { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: NOW }),
      OrderNotPayableError,
    );
  }
  assert.equal(callCount, 0);
});

test("rejects a token that does not belong to the order", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  await assert.rejects(
    startStripeCheckout(db, successfulCheckoutSession([]), { orderNumber: order.orderNumber, orderToken: "not-the-token" }, { appUrl, now: NOW }),
    OrderNotFoundError,
  );
});

test("Stripe unavailability throws StripeUnavailableError and keeps the payment retryable", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const provider: StripeCheckoutClient = {
    async createCheckoutSession() { throw new StripeUnavailableError(); },
  };

  await assert.rejects(
    startStripeCheckout(db, provider, { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: NOW }),
    StripeUnavailableError,
  );

  const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
  assert.equal(payment.providerOrderId, null);
  assert.equal(payment.checkoutUrl, null);
});
