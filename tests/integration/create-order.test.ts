import assert from "node:assert/strict";
import test, { after } from "node:test";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import { POST } from "@/app/api/orders/route";
import { createOrder } from "@/lib/orders/create-order";
import { validateOrderInput } from "@/lib/orders/order-input";

const db = createTestPrisma();
const createdOrderNumbers: string[] = [];

after(async () => {
  if (!db) {
    return;
  }

  if (createdOrderNumbers.length > 0) {
    await db.order.deleteMany({ where: { orderNumber: { in: createdOrderNumbers } } });
  }

  await db.$disconnect();
});

async function persistOrder(rankSlug: string, extra: Record<string, unknown> = {}) {
  assert.ok(db);

  const validated = validateOrderInput({
    rankSlug,
    minecraftUsername: "  Test   Player  ",
    email: "  TEST@Example.com ",
    ...extra,
  });

  assert.ok(validated.data);
  const response = await createOrder(db, validated.data);
  createdOrderNumbers.push(response.orderNumber);

  const stored = await db.order.findUniqueOrThrow({
    where: { orderNumber: response.orderNumber },
  });

  return { response, stored };
}

const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };

test("POST /api/orders persists a server-authoritative order", databaseOptions, async () => {
  assert.ok(db);

  const request = new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "integration-authoritative-order-0001",
    },
    body: JSON.stringify({
      rankSlug: "vip-plus",
      minecraftUsername: "  Http   Player  ",
      email: "HTTP@Example.com",
      priceCents: 1,
      currency: "USD",
      status: "PAID",
    }),
  });
  const response = await POST(request);
  const body = (await response.json()) as { orderNumber: string };

  assert.equal(response.status, 201);
  createdOrderNumbers.push(body.orderNumber);

  const stored = await db.order.findUniqueOrThrow({
    where: { orderNumber: body.orderNumber },
  });

  assert.equal(stored.minecraftUsername, "Http   Player");
  assert.equal(stored.subtotalCents, 3990);
  assert.equal(stored.discountCents, 0);
  assert.equal(stored.totalCents, 3990);
  assert.equal(stored.currency, "BRL");
  assert.equal(stored.status, "PENDING_PAYMENT");
  assert.equal("id" in body, false);
  assert.equal("email" in body, false);
  assert.equal("publicToken" in body, false);
  assert.equal(typeof (body as { paymentToken?: unknown }).paymentToken, "string");
  assert.equal("checkoutIdempotencyKey" in body, false);
});

test("retrying the same idempotent API request creates exactly one order", databaseOptions, async () => {
  assert.ok(db);

  const idempotencyKey = `integration-retry-${crypto.randomUUID()}`;
  const payload = {
    rankSlug: "mvp",
    minecraftUsername: "Retry Player",
    email: "retry@example.com",
  };
  const createRequest = () =>
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

  const firstResponse = await POST(createRequest());
  const secondResponse = await POST(createRequest());
  const firstOrder = (await firstResponse.json()) as { orderNumber: string };
  const secondOrder = (await secondResponse.json()) as { orderNumber: string };

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  assert.equal(secondOrder.orderNumber, firstOrder.orderNumber);
  assert.equal(await db.order.count({ where: { checkoutIdempotencyKey: idempotencyKey } }), 1);
  createdOrderNumbers.push(firstOrder.orderNumber);
});

test("rejects an idempotency key reused with different input", databaseOptions, async () => {
  assert.ok(db);

  const idempotencyKey = `integration-conflict-${crypto.randomUUID()}`;
  const request = (minecraftUsername: string) =>
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({ rankSlug: "vip", minecraftUsername, email: "conflict@example.com" }),
    });

  const firstResponse = await POST(request("First Player"));
  const firstOrder = (await firstResponse.json()) as { orderNumber: string };
  const conflictResponse = await POST(request("Second Player"));

  assert.equal(firstResponse.status, 201);
  assert.equal(conflictResponse.status, 409);
  assert.equal(await db.order.count({ where: { checkoutIdempotencyKey: idempotencyKey } }), 1);
  createdOrderNumbers.push(firstOrder.orderNumber);
});

test("creates a valid VIP order", databaseOptions, async () => {
  const { response, stored } = await persistOrder("vip");

  assert.equal(stored.status, "PENDING_PAYMENT");
  assert.equal(stored.rankSlug, "vip");
  assert.equal(stored.rankName, "VIP");
  assert.equal(stored.rankDuration, "Vitalício");
  assert.equal(stored.minecraftUsername, "Test   Player");
  assert.equal(stored.email, "test@example.com");
  assert.equal(stored.totalCents, 1990);
  assert.equal(response.totalCents, 1990);
  assert.equal(response.currency, "BRL");
});

test("creates a valid VIP+ order", databaseOptions, async () => {
  const { stored } = await persistOrder("vip-plus");

  assert.equal(stored.rankSlug, "vip-plus");
  assert.equal(stored.rankName, "VIP+");
  assert.equal(stored.totalCents, 3990);
});

test("creates a valid MVP order", databaseOptions, async () => {
  const { stored } = await persistOrder("mvp");

  assert.equal(stored.rankSlug, "mvp");
  assert.equal(stored.rankName, "MVP");
  assert.equal(stored.totalCents, 6990);
});

test("ignores an injected client-side price", databaseOptions, async () => {
  const { stored } = await persistOrder("vip", {
    price: "R$ 0,01",
    priceCents: 1,
    subtotalCents: 1,
    discountCents: 999999,
    totalCents: 1,
    currency: "USD",
    status: "PAID",
  });

  assert.equal(stored.subtotalCents, 1990);
  assert.equal(stored.discountCents, 0);
  assert.equal(stored.totalCents, 1990);
  assert.equal(stored.currency, "BRL");
  assert.equal(stored.status, "PENDING_PAYMENT");
});

test("generates unique order identifiers and checkout idempotency keys", databaseOptions, async () => {
  assert.ok(db);

  const orders = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      persistOrder("vip", { minecraftUsername: `Unique Player ${index}` }),
    ),
  );
  const storedOrders = orders.map(({ stored }) => stored);

  assert.equal(new Set(storedOrders.map(({ orderNumber }) => orderNumber)).size, storedOrders.length);
  assert.equal(new Set(storedOrders.map(({ publicToken }) => publicToken)).size, storedOrders.length);
  assert.equal(
    new Set(storedOrders.map(({ checkoutIdempotencyKey }) => checkoutIdempotencyKey)).size,
    storedOrders.length,
  );
});

test("persists the exact order expiration timestamp", databaseOptions, async () => {
  assert.ok(db);

  const validated = validateOrderInput({
    rankSlug: "mvp",
    minecraftUsername: "Expiry Player",
    email: "expiry@example.com",
  });
  assert.ok(validated.data);

  const now = new Date("2026-10-03T12:34:56.789Z");
  const response = await createOrder(db, validated.data, { now });
  createdOrderNumbers.push(response.orderNumber);
  const stored = await db.order.findUniqueOrThrow({
    where: { orderNumber: response.orderNumber },
  });
  const expectedExpiration = new Date("2026-10-03T13:04:56.789Z");

  assert.equal(stored.expiresAt.toISOString(), expectedExpiration.toISOString());
  assert.equal(response.expiresAt, expectedExpiration.toISOString());
});
