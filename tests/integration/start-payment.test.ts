import assert from "node:assert/strict";
import test, { after } from "node:test";
import { OrderStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import type { MercadoPagoOrderRequest, MercadoPagoOrdersClient } from "@/lib/payments/mercado-pago";
import { MercadoPagoUnavailableError } from "@/lib/payments/mercado-pago";
import { OrderNotPayableError, startOrderPayment } from "@/lib/payments/start-payment";

const db = createTestPrisma();
const createdOrderIds: string[] = [];
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
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
}> = {}) {
  assert.ok(db);
  const id = crypto.randomUUID();
  const order = await db.order.create({
    data: {
      id,
      publicToken: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
      orderNumber: `SWIFT-20261003-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      status: overrides.status ?? OrderStatus.PENDING_PAYMENT,
      rankSlug: "eclipse",
      rankName: "Eclipse",
      rankDuration: "Vitalício",
      minecraftUsername: "Payment Player",
      email: "authoritative@example.com",
      currency: "BRL",
      subtotalCents: overrides.totalCents ?? 3990,
      discountCents: 0,
      totalCents: overrides.totalCents ?? 3990,
      checkoutIdempotencyKey: crypto.randomUUID(),
      expiresAt: overrides.expiresAt ?? new Date("2026-10-03T13:00:00.000Z"),
    },
  });
  createdOrderIds.push(order.id);
  return order;
}

function successfulProvider(
  calls: Array<{ request: MercadoPagoOrderRequest; key: string }>,
  providerOrderId = `ORD-${crypto.randomUUID()}`,
): MercadoPagoOrdersClient {
  return {
    async createOrder(request, key) {
      calls.push({ request, key });
      return {
        providerOrderId,
        checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${providerOrderId}`,
        providerStatus: "created",
        providerStatusDetail: "created",
      };
    },
  };
}

test("creates one Mercado Pago order from persisted authoritative values", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ request: MercadoPagoOrderRequest; key: string }> = [];

  const checkout = await startOrderPayment(
    db,
    successfulProvider(calls, "ORD-TEST-001"),
    { orderNumber: order.orderNumber, orderToken: order.publicToken },
    { appUrl, now: new Date("2026-10-03T12:00:00.000Z") },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].request.type, "online");
  assert.equal(calls[0].request.processing_mode, "manual");
  assert.equal(calls[0].request.total_amount, "39.90");
  assert.equal(calls[0].request.external_reference, order.orderNumber);
  assert.deepEqual(calls[0].request.payer, { email: "authoritative@example.com" });
  assert.deepEqual(calls[0].request.items, [{ title: "Rank Eclipse", quantity: 1, unit_price: "39.90", unit_measure: "unit", total_amount: "39.90", external_code: "eclipse" }]);
  assert.deepEqual(calls[0].request.config.online, {
    success_url: "https://swift.example/checkout/return/success",
    pending_url: "https://swift.example/checkout/return/pending",
    failure_url: "https://swift.example/checkout/return/failure",
    auto_return: "all",
  });
  assert.match(calls[0].key, /^[0-9a-f-]{36}$/);
  assert.equal(checkout.checkoutUrl, "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD-TEST-001");

  const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
  assert.equal(payment.providerOrderId, "ORD-TEST-001");
  assert.equal(payment.amountCents, 3990);
  assert.equal(payment.currency, "BRL");
  assert.equal(payment.status, "CREATED");
  assert.equal(await db.fulfillment.count({ where: { orderId: order.id } }), 0);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
});

test("concurrent starts share one Payment row and stable provider idempotency key", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ request: MercadoPagoOrderRequest; key: string }> = [];
  const providerOrderId = `ORD-${crypto.randomUUID()}`;
  const provider = successfulProvider(calls, providerOrderId);
  const input = { orderNumber: order.orderNumber, orderToken: order.publicToken };
  const options = { appUrl, now: new Date("2026-10-03T12:00:00.000Z") };

  const [first, second] = await Promise.all([
    startOrderPayment(db, provider, input, options),
    startOrderPayment(db, provider, input, options),
  ]);

  assert.deepEqual(second, first);
  assert.ok(calls.length >= 1);
  assert.equal(new Set(calls.map(({ key }) => key)).size, 1);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 1);
  assert.equal((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).providerOrderId, providerOrderId);
});

test("a provider race cannot overwrite the checkout persisted by the winner", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  let releaseFirst: (() => void) | undefined;
  let callCount = 0;
  const firstCanFinish = new Promise<void>((resolve) => { releaseFirst = resolve; });
  const provider: MercadoPagoOrdersClient = {
    async createOrder() {
      callCount += 1;
      const currentCall = callCount;
      if (currentCall === 1) await firstCanFinish;
      if (currentCall === 2) releaseFirst?.();
      const providerOrderId = `ORD-RACE-${currentCall}`;
      return {
        providerOrderId,
        checkoutUrl: `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${providerOrderId}`,
        providerStatus: "created",
        providerStatusDetail: "created",
      };
    },
  };
  const input = { orderNumber: order.orderNumber, orderToken: order.publicToken };
  const options = { appUrl, now: new Date("2026-10-03T12:00:00.000Z") };

  const results = await Promise.all([
    startOrderPayment(db, provider, input, options),
    startOrderPayment(db, provider, input, options),
  ]);
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });

  assert.equal(callCount, 2);
  assert.ok(payment.providerOrderId === "ORD-RACE-1" || payment.providerOrderId === "ORD-RACE-2");
  assert.equal(payment.checkoutUrl, `https://www.mercadopago.com.br/checkout/v1/redirect?order_id=${payment.providerOrderId}`);
  assert.deepEqual(results, [{ checkoutUrl: payment.checkoutUrl }, { checkoutUrl: payment.checkoutUrl }]);
});

test("retry reuses the persisted provider checkout without another provider call", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const calls: Array<{ request: MercadoPagoOrderRequest; key: string }> = [];
  const input = { orderNumber: order.orderNumber, orderToken: order.publicToken };
  const options = { appUrl, now: new Date("2026-10-03T12:00:00.000Z") };

  const first = await startOrderPayment(db, successfulProvider(calls), input, options);
  const second = await startOrderPayment(db, successfulProvider(calls), input, options);

  assert.deepEqual(second, first);
  assert.equal(calls.length, 1);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 1);
});

test("provider failure leaves the order pending and retryable", databaseOptions, async () => {
  assert.ok(db);
  const order = await createPersistedOrder();
  const provider: MercadoPagoOrdersClient = {
    async createOrder() { throw new MercadoPagoUnavailableError(); },
  };

  await assert.rejects(
    startOrderPayment(db, provider, { orderNumber: order.orderNumber, orderToken: order.publicToken }, { appUrl, now: new Date("2026-10-03T12:00:00.000Z") }),
    MercadoPagoUnavailableError,
  );

  const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
  assert.equal(stored.status, "PENDING_PAYMENT");
  assert.equal(stored.paidAt, null);
  assert.equal(await db.fulfillment.count({ where: { orderId: order.id } }), 0);
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id } });
  assert.equal(payment.providerOrderId, null);
  assert.equal(payment.checkoutUrl, null);
});

test("rejects expired and non-payable local orders before calling provider", databaseOptions, async () => {
  assert.ok(db);
  const expired = await createPersistedOrder({ expiresAt: new Date("2026-10-03T11:00:00.000Z") });
  const paid = await createPersistedOrder({ status: OrderStatus.PAID });
  let callCount = 0;
  const provider: MercadoPagoOrdersClient = {
    async createOrder() { callCount += 1; throw new Error("must not be called"); },
  };

  await assert.rejects(startOrderPayment(db, provider, { orderNumber: expired.orderNumber, orderToken: expired.publicToken }, { appUrl, now: new Date("2026-10-03T12:00:00.000Z") }), OrderNotPayableError);
  await assert.rejects(startOrderPayment(db, provider, { orderNumber: paid.orderNumber, orderToken: paid.publicToken }, { appUrl, now: new Date("2026-10-03T12:00:00.000Z") }), OrderNotPayableError);
  assert.equal(callCount, 0);
});