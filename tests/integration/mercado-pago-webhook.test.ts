import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import { OrderStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import { POST } from "@/app/api/webhooks/mercadopago/route";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const secret = "integration-webhook-secret";
const accessToken = "integration-access-token";
const originalFetch = globalThis.fetch;
const createdOrderIds: string[] = [];

type ProviderOverrides = Partial<{
  id: string;
  external_reference: string;
  total_amount: string;
  currency_id: string;
  status: string;
  status_detail: string;
}>;

before(() => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
  process.env.MERCADOPAGO_ACCESS_TOKEN = accessToken;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (!db) return;
  if (createdOrderIds.length > 0) {
    const paymentIds = (await db.payment.findMany({ where: { orderId: { in: createdOrderIds } }, select: { providerOrderId: true } }))
      .flatMap(({ providerOrderId }) => providerOrderId ? [providerOrderId] : []);
    await db.paymentEvent.deleteMany({ where: { providerResourceId: { in: paymentIds } } });
    await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await db.$disconnect();
});

async function fixture(status: OrderStatus = OrderStatus.PENDING_PAYMENT) {
  assert.ok(db);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const providerOrderId = `ORD${randomUUID().replaceAll("-", "")}`;
  const order = await db.order.create({
    data: {
      publicToken: randomUUID().replaceAll("-", "").repeat(2),
      orderNumber: `SWIFT-20261003-${suffix}`,
      status,
      rankSlug: "vip",
      rankName: "VIP",
      rankDuration: "Vitalício",
      minecraftUsername: "WebhookPlayer",
      email: "webhook@example.com",
      currency: "BRL",
      subtotalCents: 1990,
      discountCents: 0,
      totalCents: 1990,
      checkoutIdempotencyKey: randomUUID(),
      expiresAt: new Date("2026-10-04T00:00:00.000Z"),
      paidAt: status === OrderStatus.PAID ? new Date("2026-10-03T10:00:00.000Z") : null,
      payments: {
        create: {
          providerOrderId,
          providerIdempotencyKey: randomUUID(),
          amountCents: 1990,
          currency: "BRL",
          status: status === OrderStatus.PAID ? "APPROVED" : "CREATED",
        },
      },
    },
    include: { payments: true },
  });
  createdOrderIds.push(order.id);
  return { order, payment: order.payments[0], providerOrderId };
}

function providerBody(providerOrderId: string, orderNumber: string, overrides: ProviderOverrides = {}) {
  return {
    id: overrides.id ?? providerOrderId,
    external_reference: overrides.external_reference ?? orderNumber,
    total_amount: overrides.total_amount ?? "19.90",
    currency_id: overrides.currency_id ?? "BRL",
    status: overrides.status ?? "processed",
    status_detail: overrides.status_detail ?? "accredited",
    transactions: { payments: [{ id: `PAY${providerOrderId.slice(3)}`, payment_method: { id: "pix", type: "bank_transfer" } }] },
  };
}

function signedRequest(providerOrderId: string, requestId: string = randomUUID(), options: { type?: string; signature?: string } = {}) {
  const timestamp = "1742505638683";
  const digest = createHmac("sha256", secret)
    .update(`id:${providerOrderId.toLowerCase()};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");
  const type = options.type ?? "order";
  return new Request(`https://swift.example/api/webhooks/mercadopago?data.id=${providerOrderId}&type=${type}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": requestId,
      "x-signature": options.signature ?? `ts=${timestamp},v1=${digest}`,
    },
    body: JSON.stringify({ action: "order.processed", type, data: { id: providerOrderId }, untrusted_status: "approved" }),
  });
}

function mockProvider(body: unknown, status = 200) {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    assert.match(String(input), /^https:\/\/api\.mercadopago\.com\/v1\/orders\//);
    assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${accessToken}`);
    return Response.json(body, { status });
  };
  return () => calls;
}

test("valid signed order webhook re-fetches provider and marks the order paid", databaseOptions, async () => {
  assert.ok(db);
  const { order, providerOrderId } = await fixture();
  const calls = mockProvider(providerBody(providerOrderId, order.orderNumber));
  const result = await POST(signedRequest(providerOrderId, "valid-request"));

  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { received: true });
  assert.equal(calls(), 1);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  const payment = await db.payment.findUniqueOrThrow({ where: { providerOrderId } });
  assert.equal(payment.status, "APPROVED");
  assert.match(payment.providerPaymentId ?? "", /^PAY/);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: providerOrderId } }), 1);
  assert.equal(await db.fulfillment.count({ where: { orderId: order.id } }), 0);
});

test("invalid and malformed signatures do not call provider or mutate payment", databaseOptions, async () => {
  assert.ok(db);
  for (const signature of [`ts=1742505638683,v1=${"0".repeat(64)}`, "malformed"]) {
    const { order, providerOrderId } = await fixture();
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
    const result = await POST(signedRequest(providerOrderId, randomUUID(), { signature }));
    assert.equal(result.status, 401);
    assert.equal(calls, 0);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
    assert.equal(await db.paymentEvent.count({ where: { providerResourceId: providerOrderId } }), 0);
    assert.doesNotMatch(JSON.stringify(await result.json()), /secret|access-token|stack/i);
  }
});

test("wrong webhook type is acknowledged without persistence or provider calls", databaseOptions, async () => {
  assert.ok(db);
  const { providerOrderId } = await fixture();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error("must not be called"); };
  const result = await POST(signedRequest(providerOrderId, randomUUID(), { type: "payment" }));
  assert.equal(result.status, 200);
  assert.equal(calls, 0);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: providerOrderId } }), 0);
});

test("duplicate delivery is a fast idempotent success", databaseOptions, async () => {
  assert.ok(db);
  const { order, providerOrderId } = await fixture();
  const calls = mockProvider(providerBody(providerOrderId, order.orderNumber));
  const requestId = randomUUID();
  assert.equal((await POST(signedRequest(providerOrderId, requestId))).status, 200);
  assert.equal((await POST(signedRequest(providerOrderId, requestId))).status, 200);
  assert.equal(calls(), 1);
  assert.equal(await db.paymentEvent.count({ where: { providerResourceId: providerOrderId } }), 1);
  assert.equal(await db.payment.count({ where: { orderId: order.id } }), 1);
});

for (const [name, overrides, code] of [
  ["providerOrderId", { id: "ORDDIFFERENT" }, "PROVIDER_ORDER_ID_MISMATCH"],
  ["external_reference", { external_reference: "SWIFT-20261003-WRONG00000" }, "EXTERNAL_REFERENCE_MISMATCH"],
  ["amount", { total_amount: "20.00" }, "AMOUNT_MISMATCH"],
  ["currency", { currency_id: "USD" }, "CURRENCY_MISMATCH"],
] as const) {
  test(`${name} mismatch is recorded and never marks paid`, databaseOptions, async () => {
    assert.ok(db);
    const { order, providerOrderId } = await fixture();
    mockProvider(providerBody(providerOrderId, order.orderNumber, overrides));
    const result = await POST(signedRequest(providerOrderId));
    assert.equal(result.status, 200);
    assert.notEqual((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
    const event = await db.paymentEvent.findFirstOrThrow({ where: { providerResourceId: providerOrderId } });
    assert.equal(event.status, "DEAD_LETTER");
    assert.equal(event.lastErrorCode, code);
  });
}

test("pending provider state remains pending", databaseOptions, async () => {
  assert.ok(db);
  const { order, providerOrderId } = await fixture();
  mockProvider(providerBody(providerOrderId, order.orderNumber, { status: "processing", status_detail: "in_process" }));
  assert.equal((await POST(signedRequest(providerOrderId))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
  assert.equal((await db.payment.findUniqueOrThrow({ where: { providerOrderId } })).status, "PENDING");
});

for (const [providerStatus, detail, paymentStatus] of [
  ["failed", "rejected_by_issuer", "REJECTED"],
  ["canceled", "canceled", "CANCELLED"],
] as const) {
  test(`${providerStatus} payment follows failure lifecycle`, databaseOptions, async () => {
    assert.ok(db);
    const { order, providerOrderId } = await fixture();
    mockProvider(providerBody(providerOrderId, order.orderNumber, { status: providerStatus, status_detail: detail }));
    assert.equal((await POST(signedRequest(providerOrderId))).status, 200);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAYMENT_FAILED");
    assert.equal((await db.payment.findUniqueOrThrow({ where: { providerOrderId } })).status, paymentStatus);
  });
}

test("a stale pending event cannot regress a paid order", databaseOptions, async () => {
  assert.ok(db);
  const { order, providerOrderId } = await fixture(OrderStatus.PAID);
  mockProvider(providerBody(providerOrderId, order.orderNumber, { status: "processing", status_detail: "in_process" }));
  assert.equal((await POST(signedRequest(providerOrderId))).status, 200);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PAID");
  assert.equal((await db.payment.findUniqueOrThrow({ where: { providerOrderId } })).status, "APPROVED");
});

test("provider outage is retryable and cannot mark an order paid", databaseOptions, async () => {
  assert.ok(db);
  const { order, providerOrderId } = await fixture();
  mockProvider({ private_provider_error: "do-not-leak" }, 503);
  const result = await POST(signedRequest(providerOrderId));
  assert.equal(result.status, 503);
  const responseBody = JSON.stringify(await result.json());
  assert.doesNotMatch(responseBody, /private_provider_error|do-not-leak|access-token|webhook-secret/i);
  assert.equal((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING_PAYMENT");
  const event = await db.paymentEvent.findFirstOrThrow({ where: { providerResourceId: providerOrderId } });
  assert.equal(event.status, "RETRY_PENDING");
  assert.equal(event.lastErrorCode, "PROVIDER_UNAVAILABLE");
});
