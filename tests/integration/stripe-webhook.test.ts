import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test, { after, before, mock } from "node:test";
import { OrderStatus, PaymentProvider, PaymentStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const secret = "whsec_stripe_integration_test_secret";
const secretKey = "sk_test_stripe_integration_test_key";
const originalFetch = globalThis.fetch;
const createdOrderIds: string[] = [];
const createdEventIds = new Set<string>();

// Exercise the production handler with the runner's isolated PostgreSQL client
// through the same Hyperdrive-style binding path the Worker runtime uses.
mock.module("@/lib/auth-api/get-env", {
  namedExports: {
    getWorkersEnv: async () => ({
      APP_URL: "https://swift.example",
      AUTH_HYPERDRIVE: { connectionString: process.env.DATABASE_URL! },
    }),
  },
});
const { POST } = await import("@/app/api/webhooks/stripe/route");

before(() => {
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  process.env.STRIPE_SECRET_KEY = secretKey;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (!db) return;
  if (createdOrderIds.length > 0) {
    await db.paymentEvent.deleteMany({ where: { provider: PaymentProvider.STRIPE, providerEventId: { in: [...createdEventIds] } } });
    await db.fulfillment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await db.$disconnect();
});

async function fixture(
  status: OrderStatus = OrderStatus.PENDING_PAYMENT,
  overrides: Partial<{
    orderNumber: string;
    totalCents: number;
    currency: string;
    rankSlug: string;
  }> = {},
) {
  assert.ok(db);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const orderNumber = overrides.orderNumber ?? `SWIFT-20261106-${suffix}`;
  const providerPaymentId = `pi_${randomUUID().replaceAll("-", "")}`;
  const order = await db.order.create({
    data: {
      publicToken: randomUUID().replaceAll("-", "").repeat(2),
      orderNumber,
      status,
      rankSlug: overrides.rankSlug ?? "swift",
      rankName: "Swift",
      rankDuration: "Mensal",
      minecraftUsername: "StripePlayer",
      email: "stripe@example.com",
      currency: overrides.currency ?? "BRL",
      subtotalCents: overrides.totalCents ?? 1990,
      discountCents: 0,
      totalCents: overrides.totalCents ?? 1990,
      checkoutIdempotencyKey: randomUUID(),
      expiresAt: new Date("2026-11-07T00:00:00.000Z"),
      paidAt: status === OrderStatus.PAID ? new Date("2026-11-06T10:00:00.000Z") : null,
      payments: {
        create: {
          provider: PaymentProvider.STRIPE,
          providerIdempotencyKey: randomUUID(),
          amountCents: overrides.totalCents ?? 1990,
          currency: overrides.currency ?? "BRL",
          status: status === OrderStatus.PAID ? PaymentStatus.APPROVED : PaymentStatus.CREATED,
        },
      },
    },
    include: { payments: true },
  });
  createdOrderIds.push(order.id);
  return { ...order, providerPaymentId };
}

function timestamp(): string {
  return String(Math.floor(Date.now() / 1000));
}

function signStripe(rawBody: string, requestTimestamp: string = timestamp()): string {
  const signedPayload = `${requestTimestamp}.${rawBody}`;
  return createHmac("sha256", secret).update(signedPayload).digest("hex");
}

function stripeRequest(
  eventType: string,
  eventId: string,
  object: unknown,
  options: { timestamp?: string; signature?: string } = {},
): Request {
  createdEventIds.add(eventId);
  const rawBody = JSON.stringify({
    id: eventId,
    type: eventType,
    data: { object },
  });
  const ts = options.timestamp ?? timestamp();
  const signature = options.signature ?? signStripe(rawBody, ts);
  return new Request("https://swift.example/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": `t=${ts},v1=${signature}`,
    },
    body: rawBody,
  });
}

function mockStripe(body: unknown, status = 200): () => number {
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    assert.match(String(_input), /^https:\/\/api\.stripe\.com\/v1\/(checkout\/sessions|invoices|subscriptions|charges)\/[A-Za-z0-9_]+$/);
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      `Bearer ${secretKey}`,
    );
    return Response.json(body, { status });
  };
  return () => calls;
}

test("public route verifies Stripe signature before processing", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  const result = await POST(stripeRequest("checkout.session.completed", "evt_invalid", { id: "cs_test" }, { signature: "0".repeat(64) }));
  assert.equal(result.status, 401);
  assert.equal(calls, 0);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
});

test("invalid and malformed signatures do not call provider or mutate payment", databaseOptions, async () => {
  assert.ok(db);
  for (const signature of ["0".repeat(64), "malformed", "t=123,v1="]) {
    const order = await fixture();
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
    const result = await POST(stripeRequest("checkout.session.completed", randomUUID(), { id: "cs_test" }, { signature }));
    assert.equal(result.status, 401);
    assert.equal(calls, 0);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
  }
});

test("expired signatures and modified raw bodies are rejected before any side effects", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  const expired = stripeRequest("checkout.session.completed", "evt_expired", { id: "cs_test" }, { timestamp: String(Math.floor(Date.now() / 1000) - 600) });
  const signed = stripeRequest("checkout.session.completed", "evt_tampered", { id: "cs_test" });
  const tampered = new Request(signed.url, { method: "POST", headers: signed.headers, body: `${await signed.text()} ` });
  for (const request of [expired, tampered]) {
    const response = await POST(request);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "INVALID_SIGNATURE");
  }
  assert.equal(calls, 0);
  assert.equal(await db.paymentEvent.count({ where: { providerEventId: { in: ["evt_expired", "evt_tampered"] } } }), 0);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
});

test("checkout.session.completed marks payment approved and order paid", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.completed", "evt_completed_1", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  assert.equal(await db.fulfillment.count({ where: { orderId: order.id } }), 1);
  const payment = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
  assert.equal(payment.status, "APPROVED");
  assert.equal(payment.providerOrderId, sessionId);
  assert.equal(payment.providerPaymentId, order.providerPaymentId);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: "evt_completed_1" } }), 1);
});

test("checkout.session.async_payment_succeeded marks payment approved and order paid", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.async_payment_succeeded", "evt_async_succeeded", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
});

test("checkout.session.async_payment_failed marks payment rejected and order failed", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "expired",
    payment_status: "unpaid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: null,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.async_payment_failed", "evt_async_failed", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAYMENT_FAILED");
  const payment = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
  assert.equal(payment.status, "REJECTED");
});

test("checkout.session.expired expires a pending order and cancels the payment", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "expired",
    payment_status: "unpaid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: null,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.expired", "evt_session_expired", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "EXPIRED");
  const payment = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
  assert.equal(payment.status, "CANCELLED");
});

test("charge.refunded marks payment refunded and order refunded", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture(OrderStatus.PAID);
  const chargeId = `ch_${randomUUID().replaceAll("-", "")}`;
  const chargeBody = {
    id: chargeId,
    object: "charge",
    status: "succeeded",
    amount: 1990,
    currency: "brl",
    refunded: true,
    receipt_email: null,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(chargeBody);
  const result = await POST(stripeRequest("charge.refunded", "evt_charge_refunded", { id: chargeId }));
  assert.equal(result.status, 200);
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "REFUNDED");
  const payment = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
  assert.equal(payment.status, "REFUNDED");
});

test("duplicate event is idempotent success", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  const calls = mockStripe(sessionBody);
  const eventId = "evt_duplicate_test";
  assert.equal((await POST(stripeRequest("checkout.session.completed", eventId, { id: sessionId }))).status, 200);
  assert.equal((await POST(stripeRequest("checkout.session.completed", eventId, { id: sessionId }))).status, 200);
  assert.equal(calls(), 1);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: eventId } }), 1);
  assert.equal(await db.fulfillment.count({ where: { orderId: order.id } }), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
});

test("amount mismatch does not mark order paid", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 2500,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.completed", "evt_amount_mismatch", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "REVIEW_REQUIRED");
  const event = await db.paymentEvent.findFirstOrThrow({ where: { providerResourceId: "evt_amount_mismatch" } });
  assert.equal(event.status, "DEAD_LETTER");
  assert.equal(event.lastErrorCode, "AMOUNT_MISMATCH");
});

test("currency mismatch does not mark order paid", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    amount_total: 1990,
    currency: "usd",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  mockStripe(sessionBody);
  const result = await POST(stripeRequest("checkout.session.completed", "evt_currency_mismatch", { id: sessionId }));
  assert.equal(result.status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "REVIEW_REQUIRED");
  const event = await db.paymentEvent.findFirstOrThrow({ where: { providerResourceId: "evt_currency_mismatch" } });
  assert.equal(event.lastErrorCode, "CURRENCY_MISMATCH");
});

test("stale pending event cannot regress a paid order", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture(OrderStatus.PAID);
  const sessionId = `cs_${randomUUID().replaceAll("-", "")}`;
  const sessionBody = {
    id: sessionId,
    object: "checkout.session",
    mode: "payment",
    status: "open",
    payment_status: "unpaid",
    amount_total: 1990,
    currency: "brl",
    client_reference_id: order.orderNumber,
    payment_intent: order.providerPaymentId,
    metadata: { orderNumber: order.orderNumber, paymentId: order.payments[0].id },
  };
  mockStripe(sessionBody);
  assert.equal((await POST(stripeRequest("checkout.session.completed", "evt_stale_pending", { id: sessionId }))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  const payment = await db.payment.findUniqueOrThrow({ where: { id: order.payments[0].id } });
  assert.equal(payment.status, "APPROVED");
});

test("provider outage is retryable and cannot mark order paid", databaseOptions, async () => {
  assert.ok(db);
  const order = await fixture();
  globalThis.fetch = async () => Response.json({ error: "provider_unavailable" }, { status: 503 });
  const result = await POST(stripeRequest("checkout.session.completed", "evt_provider_outage", { id: "cs_test" }));
  assert.equal(result.status, 503);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
  const event = await db.paymentEvent.findFirstOrThrow({ where: { providerResourceId: "evt_provider_outage" } });
  assert.equal(event.status, "RETRY_PENDING");
  assert.equal(event.lastErrorCode, "PROVIDER_UNAVAILABLE");
});

test("unknown event type is acknowledged as ignored", databaseOptions, async () => {
  assert.ok(db);
  await fixture();
  globalThis.fetch = async () => { throw new Error("must not be called"); };
  const result = await POST(stripeRequest("account.updated", "evt_unknown", { id: "acct_test" }));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ignored, true);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: "evt_unknown" } }), 1);
});
