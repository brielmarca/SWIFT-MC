import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import {
  OrderStatus,
  FulfillmentStatus,
  PaymentProvider,
  PaymentStatus,
} from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import {
  createFulfillmentForOrder,
  processFulfillment,
  processPendingFulfillments,
  getFulfillmentStats,
} from "@/lib/fulfillment/fulfillment-service";
import {
  createMinecraftGrantClient,
  getMinecraftGrantConfig,
  type GrantResult,
} from "@/lib/minecraft/grant-client";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const createdOrderIds: string[] = [];
const createdFulfillmentIds: string[] = [];

// Mock grant client that can be configured per test
let grantResult: GrantResult = { status: "granted", reference: "ref_123" };
let grantCalls: Array<{ type: string; username: string; rankSlug?: string; amount?: number; idempotencyKey: string }> = [];
let shouldThrow = false;

const mockGrantClient = {
  async grantRank(fulfillmentId: string, username: string, rankSlug: string): Promise<GrantResult> {
    grantCalls.push({ type: "rank", username, rankSlug, idempotencyKey: fulfillmentId });
    if (shouldThrow) throw new Error("Minecraft unavailable");
    return grantResult;
  },
  async grantCoins(fulfillmentId: string, username: string, amount: number): Promise<GrantResult> {
    grantCalls.push({ type: "coins", username, amount, idempotencyKey: fulfillmentId });
    if (shouldThrow) throw new Error("Minecraft unavailable");
    return grantResult;
  },
};

after(async () => {
  if (!db) return;
  if (createdFulfillmentIds.length > 0) {
    await db.fulfillment.deleteMany({ where: { id: { in: createdFulfillmentIds } } });
  }
  if (createdOrderIds.length > 0) {
    await db.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await db.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  }
  await db.$disconnect();
});

beforeEach(() => {
  grantResult = { status: "granted", reference: "ref_123" };
  grantCalls = [];
  shouldThrow = false;
});

async function createTestOrder(overrides: Partial<{
  status: OrderStatus;
  totalCents: number;
  rankSlug: string;
  rankName: string;
  rankDuration: string;
  minecraftUsername: string;
}> = {}) {
  assert.ok(db);
  const order = await db.order.create({
    data: {
      publicToken: crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", ""),
      orderNumber: `SWIFT-20261106-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
      status: overrides.status ?? OrderStatus.PAID,
      rankSlug: overrides.rankSlug ?? "swift",
      rankName: overrides.rankName ?? "Swift",
      rankDuration: overrides.rankDuration ?? "Mensal",
      minecraftUsername: overrides.minecraftUsername ?? "TestPlayer",
      email: "test@example.com",
      currency: "BRL",
      subtotalCents: overrides.totalCents ?? 1990,
      discountCents: 0,
      totalCents: overrides.totalCents ?? 1990,
      checkoutIdempotencyKey: crypto.randomUUID(),
      expiresAt: new Date("2026-11-07T00:00:00.000Z"),
      payments: {
        create: {
          provider: PaymentProvider.STRIPE,
          providerOrderId: `pi_${crypto.randomUUID()}`,
          providerIdempotencyKey: crypto.randomUUID(),
          amountCents: overrides.totalCents ?? 1990,
          currency: "BRL",
          status: PaymentStatus.APPROVED,
        },
      },
    },
    include: { payments: true },
  });
  createdOrderIds.push(order.id);
  return order;
}

test("createFulfillmentForOrder creates a PENDING fulfillment record", databaseOptions, async () => {
  assert.ok(db);
  const order = await createTestOrder({ status: OrderStatus.PAID });

  const result = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );

  assert.equal(result.created, true);
  assert.equal(result.fulfillment.status, FulfillmentStatus.PENDING);
  assert.equal(result.fulfillment.orderId, order.id);
  assert.equal(result.fulfillment.minecraftUsername, order.minecraftUsername);
  assert.equal(result.fulfillment.rankSlug, order.rankSlug);
  createdFulfillmentIds.push(result.fulfillment.id);
});

test("createFulfillmentForOrder is idempotent - no duplicate for same order", databaseOptions, async () => {
  assert.ok(db);
  const order = await createTestOrder({ status: OrderStatus.PAID });

  const first = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(first.fulfillment.id);

  const second = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );

  assert.equal(second.created, false);
  assert.equal(second.fulfillment.id, first.fulfillment.id);
});

test("processFulfillment grants rank via Minecraft and marks order FULFILLED", databaseOptions, async () => {
  assert.ok(db);
  const order = await createTestOrder({ status: OrderStatus.PAID });
  const { fulfillment } = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(fulfillment.id);

  const now = new Date();
  const result = await processFulfillment(
    db,
    { ...fulfillment, order } as never,
    mockGrantClient as never,
    now,
  );

  assert.equal(result.status, "granted");
  assert.equal(grantCalls.length, 1);
  assert.equal(grantCalls[0].type, "rank");
  assert.equal(grantCalls[0].username, order.minecraftUsername);
  assert.equal(grantCalls[0].rankSlug, order.rankSlug);

  const updated = await db.fulfillment.findUnique({ where: { id: fulfillment.id } });
  assert.equal(updated!.status, FulfillmentStatus.SUCCEEDED);
  assert.equal(updated!.fulfilledAt !== null, true);

  const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
  assert.equal(updatedOrder!.status, OrderStatus.FULFILLED);
});

test("processFulfillment handles already_granted as success", databaseOptions, async () => {
  assert.ok(db);
  grantResult = { status: "already_granted", reference: "ref_existing" };
  const order = await createTestOrder({ status: OrderStatus.PAID });
  const { fulfillment } = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(fulfillment.id);

  const now = new Date();
  const result = await processFulfillment(
    db,
    { ...fulfillment, order } as never,
    mockGrantClient as never,
    now,
  );

  assert.equal(result.status, "already_granted");
  const updated = await db.fulfillment.findUnique({ where: { id: fulfillment.id } });
  assert.equal(updated!.status, FulfillmentStatus.SUCCEEDED);
});

test("processFulfillment retries when Minecraft is unavailable", databaseOptions, async () => {
  assert.ok(db);
  shouldThrow = true;
  const order = await createTestOrder({ status: OrderStatus.PAID });
  const { fulfillment } = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(fulfillment.id);

  const now = new Date();
  const result = await processFulfillment(
    db,
    { ...fulfillment, order } as never,
    mockGrantClient as never,
    now,
  );

  assert.equal(result.status, "retry");
  assert.equal(grantCalls.length, 1);

  const updated = await db.fulfillment.findUnique({ where: { id: fulfillment.id } });
  assert.equal(updated!.status, FulfillmentStatus.RETRY_PENDING);
  assert.equal(updated!.attemptCount, 1);
  assert.equal(updated!.nextAttemptAt !== null, true);
});

test("processFulfillment marks FAILED when player not found", databaseOptions, async () => {
  assert.ok(db);
  grantResult = { status: "not_found", reason: "player not found on server" };
  const order = await createTestOrder({ status: OrderStatus.PAID });
  const { fulfillment } = await createFulfillmentForOrder(
    db,
    {
      id: order.id,
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      rankName: order.rankName,
      minecraftUsername: order.minecraftUsername,
      totalCents: order.totalCents,
      currency: order.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(fulfillment.id);

  const now = new Date();
  const result = await processFulfillment(
    db,
    { ...fulfillment, order } as never,
    mockGrantClient as never,
    now,
  );

  assert.equal(result.status, "not_found");
  const updated = await db.fulfillment.findUnique({ where: { id: fulfillment.id } });
  assert.equal(updated!.status, FulfillmentStatus.FAILED);
  assert.equal(updated!.lastErrorCode, "PLAYER_NOT_FOUND");
});

test("processPendingFulfillments processes multiple fulfillments", databaseOptions, async () => {
  assert.ok(db);
  const order1 = await createTestOrder({ status: OrderStatus.PAID, minecraftUsername: "Player1" });
  const order2 = await createTestOrder({ status: OrderStatus.PAID, minecraftUsername: "Player2" });

  await createFulfillmentForOrder(
    db,
    {
      id: order1.id,
      orderNumber: order1.orderNumber,
      rankSlug: order1.rankSlug,
      rankName: order1.rankName,
      minecraftUsername: order1.minecraftUsername,
      totalCents: order1.totalCents,
      currency: order1.currency,
    },
    "rank",
  );
  const { fulfillment: f2 } = await createFulfillmentForOrder(
    db,
    {
      id: order2.id,
      orderNumber: order2.orderNumber,
      rankSlug: order2.rankSlug,
      rankName: order2.rankName,
      minecraftUsername: order2.minecraftUsername,
      totalCents: order2.totalCents,
      currency: order2.currency,
    },
    "rank",
  );
  createdFulfillmentIds.push(f2.id);

  const now = new Date();
  const result = await processPendingFulfillments(
    db,
    mockGrantClient as never,
    now,
  );

  assert.equal(result.processed, 2);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.retried, 0);
});

test("getFulfillmentStats returns correct counts", databaseOptions, async () => {
  assert.ok(db);
  const stats = await getFulfillmentStats(db);
  assert.equal(typeof stats.pending, "number");
  assert.equal(typeof stats.processing, "number");
  assert.equal(typeof stats.succeeded, "number");
  assert.equal(typeof stats.failed, "number");
  assert.equal(typeof stats.retryPending, "number");
});

test("isMinecraftGrantConfig returns null when not configured", () => {
  const config = getMinecraftGrantConfig({ MINECRAFT_FULFILLMENT_URL: undefined, MINECRAFT_FULFILLMENT_TOKEN: undefined });
  assert.equal(config, null);
});

test("createMinecraftGrantClient creates a client with grantRank and grantCoins", () => {
  const config = { baseUrl: "https://minecraft.example.com/v1/", token: "test_token" };
  const client = createMinecraftGrantClient(config);
  assert.equal(typeof client.grantRank, "function");
  assert.equal(typeof client.grantCoins, "function");
});
