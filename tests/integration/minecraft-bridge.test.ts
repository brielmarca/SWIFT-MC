import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { FulfillmentStatus, OrderStatus, PaymentProvider, PaymentStatus } from "@prisma/client";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";
import { acknowledgeBridgeDelivery, bindMinecraftLinkCode, generateMinecraftLinkCode, getBridgeLinkStatus, listPendingBridgeDeliveries, queueVipSnapshot, revokeVipEntitlementsForOrder, upsertVipEntitlementForPaidOrder } from "@/lib/minecraft-bridge/service";
import { verifyBridgeRequest } from "@/lib/minecraft-bridge/auth";
import { MINECRAFT_NAMESPACE } from "@/lib/minecraft-bridge/vip";

const db = createTestPrisma();
const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };
const created: { userIds: string[]; orderIds: string[]; deliveryIds: string[] } = { userIds: [], orderIds: [], deliveryIds: [] };

after(async () => {
  if (!db) return;
  await db.bridgeDelivery.deleteMany({ where: { OR: [{ orderId: { in: created.orderIds } }, { deliveryId: { in: created.deliveryIds } }, { accountId: { in: created.userIds } }] } });
  await db.vipEntitlement.deleteMany({ where: { OR: [{ orderId: { in: created.orderIds } }, { userId: { in: created.userIds } }] } });
  await db.minecraftLinkCode.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.minecraftIdentity.deleteMany({ where: { userId: { in: created.userIds } } });
  await db.minecraftDeliverySequence.deleteMany({ where: { accountId: { in: created.userIds } } });
  await db.fulfillment.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.payment.deleteMany({ where: { orderId: { in: created.orderIds } } });
  await db.order.deleteMany({ where: { id: { in: created.orderIds } } });
  await db.user.deleteMany({ where: { id: { in: created.userIds } } });
  await db.$disconnect();
});

async function user() {
  assert.ok(db);
  const u = await db.user.create({ data: { emailNormalized: `${randomUUID()}@example.test`, emailVerifiedAt: new Date(), displayName: "Bridge User", status: "ACTIVE" } });
  created.userIds.push(u.id); return u;
}
const uuid = (n: number) => `12345678-1234-4234-8234-${String(n).padStart(12, "0")}`;

async function paidVipOrder(u: { id: string }, rankSlug = "swift", totalCents = 1990) {
  assert.ok(db);
  const o = await db.order.create({ data: {
    publicToken: randomUUID().replaceAll("-", "").repeat(2), orderNumber: `SWIFT-BRIDGE-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: OrderStatus.PAID, rankSlug, rankName: rankSlug, rankDuration: "Mensal", minecraftUsername: "Player", email: "p@example.com", userId: u.id,
    currency: "BRL", subtotalCents: totalCents, discountCents: 0, totalCents, checkoutIdempotencyKey: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000), paidAt: new Date(),
    payments: { create: { provider: PaymentProvider.STRIPE, status: PaymentStatus.APPROVED, amountCents: totalCents, currency: "BRL", providerOrderId: `cs_${randomUUID()}`, providerIdempotencyKey: randomUUID() } },
  } });
  created.orderIds.push(o.id);
  const f = await db.fulfillment.create({ data: { orderId: o.id, status: FulfillmentStatus.PENDING, rankSlug, minecraftUsername: "Player" } });
  return { order: o, fulfillment: f };
}

test("bridge auth rejects missing/invalid secret and wrong server", databaseOptions, async () => {
  const secret = "bridge_secret_abcdefghijklmnopqrstuvwxyz";
  const bindings = { MINECRAFT_BRIDGE_SECRET: secret, MINECRAFT_BRIDGE_SERVER_ID: "swift-survival" };
  assert.throws(() => verifyBridgeRequest(new Headers({ authorization: `Bearer ${secret}` }), bindings), (e: unknown) => (e as { code?: string }).code === "WRONG_SERVER");
  assert.throws(() => verifyBridgeRequest(new Headers({ authorization: "Bearer wrong", "x-swift-server": "swift-survival" }), bindings), (e: unknown) => (e as { code?: string }).code === "UNAUTHORIZED");
  assert.doesNotThrow(() => verifyBridgeRequest(new Headers({ authorization: `Bearer ${secret}`, "x-swift-server": "swift-survival" }), bindings));
});

test("link code is single-use, 15-minute scoped, and prevents hijack/duplicate linking", databaseOptions, async () => {
  assert.ok(db);
  const a = await user(); const b = await user();
  const now = new Date("2026-11-08T12:00:00Z");
  const { code, expiresAt } = await generateMinecraftLinkCode(db, a.id, now);
  assert.ok(new Date(expiresAt).getTime() - now.getTime() <= 15 * 60 * 1000);
  const bound = await bindMinecraftLinkCode(db, { code, playerUuid: uuid(1), nickname: "PlayerA" }, new Date(now.getTime() + 1000));
  assert.equal(bound.accountId, a.id);
  await assert.rejects(() => bindMinecraftLinkCode(db, { code, playerUuid: uuid(1), nickname: "PlayerA" }, new Date(now.getTime() + 2000)), /inválid|vencid|utiliz/i);
  const bCode = await generateMinecraftLinkCode(db, b.id, now);
  await assert.rejects(() => bindMinecraftLinkCode(db, { code: bCode.code, playerUuid: uuid(1), nickname: "Other" }, now), /vinculad|UUID/i);
  const aCode2 = await generateMinecraftLinkCode(db, a.id, now);
  await assert.rejects(() => bindMinecraftLinkCode(db, { code: aCode2.code, playerUuid: uuid(2), nickname: "Hijack" }, now), /vinculad|outro jogador/i);
  const id = await db.minecraftIdentity.findFirst({ where: { userId: a.id, namespace: MINECRAFT_NAMESPACE } });
  assert.equal(id?.subject, uuid(1));
});

test("expired link code cannot bind", databaseOptions, async () => {
  assert.ok(db);
  const a = await user();
  const now = new Date("2026-11-08T12:00:00Z");
  const { code } = await generateMinecraftLinkCode(db, a.id, now);
  await assert.rejects(() => bindMinecraftLinkCode(db, { code, playerUuid: uuid(9), nickname: "Late" }, new Date(now.getTime() + 16 * 60 * 1000)));
});

test("paid VIP creates entitlement/delivery, pending is idempotent-safe, ack is duplicate-safe", databaseOptions, async () => {
  assert.ok(db);
  const a = await user();
  const boundNow = new Date("2026-11-08T12:00:00Z");
  const { code } = await generateMinecraftLinkCode(db, a.id, boundNow);
  await bindMinecraftLinkCode(db, { code, playerUuid: uuid(3), nickname: "VipPlayer" }, boundNow);
  const { order, fulfillment } = await paidVipOrder(a, "overdrive", 4990);
  const res = await upsertVipEntitlementForPaidOrder(db, { id: order.id, userId: a.id, orderNumber: order.orderNumber, rankSlug: order.rankSlug, rankName: order.rankName, minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency }, fulfillment.id, new Date("2026-11-08T13:00:00Z"));
  assert.equal(res.created, true);
  const dup = await upsertVipEntitlementForPaidOrder(db, { id: order.id, userId: a.id, orderNumber: order.orderNumber, rankSlug: order.rankSlug, rankName: order.rankName, minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency }, fulfillment.id, new Date("2026-11-08T13:00:00Z"));
  assert.equal(dup.created, false);
  const pending = await listPendingBridgeDeliveries(db, "swift-survival");
  const d = pending.deliveries.find(x => x.accountId === a.id && x.vip === "overdrive");
  assert.ok(d); created.deliveryIds.push(d!.deliveryId);
  assert.equal(d!.action, "ACTIVATE");
  assert.ok(d!.expiresAt && new Date(d!.expiresAt).getTime() > new Date("2026-11-08T13:00:00Z").getTime());
  const ack = await acknowledgeBridgeDelivery(db, { deliveryId: d!.deliveryId, sequence: d!.sequence, status: "completed", serverId: "swift-survival" });
  assert.equal(ack.ok, true);
  const ack2 = await acknowledgeBridgeDelivery(db, { deliveryId: d!.deliveryId, sequence: d!.sequence, status: "completed", serverId: "swift-survival" });
  assert.equal(ack2.ok, true);
  const pending2 = await listPendingBridgeDeliveries(db, "swift-survival");
  assert.ok(!pending2.deliveries.some(x => x.deliveryId === d!.deliveryId));
});

test("refund revokes entitlement and queues final VIP snapshot", databaseOptions, async () => {
  assert.ok(db);
  const a = await user();
  const now = new Date("2026-11-08T12:00:00Z");
  const { code } = await generateMinecraftLinkCode(db, a.id, now);
  await bindMinecraftLinkCode(db, { code, playerUuid: uuid(4), nickname: "Refunded" }, now);
  const { order, fulfillment } = await paidVipOrder(a, "swift", 990);
  await upsertVipEntitlementForPaidOrder(db, { id: order.id, userId: a.id, orderNumber: order.orderNumber, rankSlug: order.rankSlug, rankName: order.rankName, minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency }, fulfillment.id, now);
  await revokeVipEntitlementsForOrder(db, order.id, "REFUNDED", new Date(now.getTime() + 60_000));
  const ent = await db.vipEntitlement.findUnique({ where: { orderId: order.id } });
  assert.equal(ent?.status, "REVOKED");
  const pending = await db.bridgeDelivery.findMany({ where: { accountId: a.id, status: "PENDING", kind: "VIP" }, orderBy: { sequence: "desc" } });
  pending.forEach(p => created.deliveryIds.push(p.deliveryId));
  assert.ok(pending[0]);
  assert.equal(pending[0].action, "REMOVE");
  const status = await getBridgeLinkStatus(db, { accountId: a.id }, new Date(now.getTime() + 120_000));
  assert.equal(status.linked, true);
  assert.equal(status.vip, null);
});

test("offline player/link-after-payment receives snapshot once linked", databaseOptions, async () => {
  assert.ok(db);
  const a = await user();
  const now = new Date("2026-11-08T12:00:00Z");
  const { order, fulfillment } = await paidVipOrder(a, "cosmic", 2990);
  await upsertVipEntitlementForPaidOrder(db, { id: order.id, userId: a.id, orderNumber: order.orderNumber, rankSlug: order.rankSlug, rankName: order.rankName, minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency }, fulfillment.id, now);
  assert.equal((await listPendingBridgeDeliveries(db, "swift-survival")).deliveries.filter(d => d.accountId === a.id).length, 0);
  const { code } = await generateMinecraftLinkCode(db, a.id, now);
  await bindMinecraftLinkCode(db, { code, playerUuid: uuid(5), nickname: "LateLink" }, new Date(now.getTime() + 1000));
  const pending = (await listPendingBridgeDeliveries(db, "swift-survival")).deliveries.filter(d => d.accountId === a.id);
  pending.forEach(p => created.deliveryIds.push(p.deliveryId));
  assert.ok(pending.some(d => d.action === "ACTIVATE" && d.vip === "cosmic"));
});

test("server restart/reconnect safe: duplicate snapshot requests do not corrupt account sequence semantics", databaseOptions, async () => {
  assert.ok(db);
  const a = await user();
  const now = new Date("2026-11-08T12:00:00Z");
  const { code } = await generateMinecraftLinkCode(db, a.id, now);
  await bindMinecraftLinkCode(db, { code, playerUuid: uuid(6), nickname: "Restart" }, now);
  await queueVipSnapshot(db, a.id, now); await queueVipSnapshot(db, a.id, new Date(now.getTime() + 1));
  const pending = await db.bridgeDelivery.findMany({ where: { accountId: a.id, status: "PENDING" }, orderBy: { sequence: "asc" } });
  pending.forEach(p => created.deliveryIds.push(p.deliveryId));
  assert.equal(pending.length, 1); // pending VIP superseded, only latest pending remains
});
