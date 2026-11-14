import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { OrderStatus, Prisma, type PrismaClient } from "@prisma/client";
import {
  MINECRAFT_NAMESPACE, VIP_DAYS, absoluteVipExpiry, isVipRank, normalizeLinkCode,
  normalizeNickname, normalizeUuid, selectActiveVipSnapshot, type VipRankSlug,
} from "./vip";

type Db = PrismaClient | Prisma.TransactionClient;

const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const LINK_CODE_BYTES = 24;
const PENDING_LIMIT_MAX = 200;

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
function makeCode(): string { return randomBytes(LINK_CODE_BYTES).toString("base64url"); }
function isoUtc(date: Date): string { return date.toISOString().replace(/\.\d{3}Z$/, "Z"); }

export class BridgeValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ValueError"; }
}

async function nextSequence(tx: Db, accountId: string): Promise<bigint> {
  const rows = await tx.$queryRaw<Array<{ seq: bigint | number | string }>>`
    INSERT INTO "MinecraftDeliverySequence" ("accountId", "nextSeq", "updatedAt")
    VALUES (${accountId}, 2, now())
    ON CONFLICT ("accountId") DO UPDATE
      SET "nextSeq" = "MinecraftDeliverySequence"."nextSeq" + 1,
          "updatedAt" = now()
    RETURNING ("nextSeq" - 1) AS seq`;
  const seq = rows[0]?.seq;
  return typeof seq === "bigint" ? seq : BigInt(seq ?? 1);
}

async function supersedePendingVip(tx: Db, accountId: string, now: Date): Promise<void> {
  await tx.bridgeDelivery.updateMany({
    where: { accountId, kind: "VIP", status: "PENDING" },
    data: { status: "SUPERSEDED", supersededAt: now },
  });
}

export async function queueVipSnapshot(tx: Db, accountId: string, now = new Date()): Promise<void> {
  const identity = await tx.minecraftIdentity.findFirst({ where: { userId: accountId, namespace: MINECRAFT_NAMESPACE } });
  if (!identity) return;
  await supersedePendingVip(tx, accountId, now);
  const entitlements = await tx.vipEntitlement.findMany({
    where: { userId: accountId },
    select: { rankSlug: true, expiresAt: true, status: true },
  });
  const snapshot = selectActiveVipSnapshot(entitlements, now);
  const seq = await nextSequence(tx, accountId);
  const deliveryId = `vip_${accountId}_${seq.toString()}`;
  await tx.bridgeDelivery.create({
    data: {
      deliveryId, accountId, playerUuid: identity.subject, kind: "VIP",
      action: snapshot ? "ACTIVATE" : "REMOVE",
      vip: snapshot?.rank ?? null,
      expiresAt: snapshot?.expiresAt ?? null,
      sequence: seq, status: "PENDING",
    },
  });
}

export async function generateMinecraftLinkCode(db: PrismaClient, userId: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{1,191}$/.test(userId)) throw new BridgeValidationError("accountId inválido");
  const identity = await db.minecraftIdentity.findFirst({ where: { userId, namespace: MINECRAFT_NAMESPACE } });
  const code = makeCode();
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
  await db.$transaction(async tx => {
    await tx.minecraftLinkCode.deleteMany({ where: { userId, OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }] } });
    await tx.minecraftLinkCode.create({
      data: { userId, identityId: identity?.id ?? null, codeHash: sha256Hex(code), expiresAt },
    });
  });
  return { code, expiresAt: isoUtc(expiresAt) };
}

export async function bindMinecraftLinkCode(db: PrismaClient, input: { code: string; playerUuid: string; nickname: string }, now = new Date()) {
  const code = normalizeLinkCode(input.code);
  const playerUuid = normalizeUuid(input.playerUuid);
  const nickname = normalizeNickname(input.nickname);
  if (!code) throw new BridgeValidationError("Código inválido, vencido ou já utilizado");
  if (!playerUuid || !nickname) throw new BridgeValidationError("UUID ou nome inválido");
  const codeHash = sha256Hex(code);
  return db.$transaction(async tx => {
    const row = await tx.minecraftLinkCode.findUnique({ where: { codeHash } });
    if (!row || row.consumedAt || row.expiresAt.getTime() <= now.getTime()) {
      throw new BridgeValidationError("Código inválido, vencido ou já utilizado");
    }
    const accountId = row.userId;
    const user = await tx.user.findUnique({ where: { id: accountId }, select: { id: true, status: true } });
    if (!user || user.status !== "ACTIVE") throw new BridgeValidationError("Código inválido, vencido ou já utilizado");

    const [ownerIdentity, subjectOwner] = await Promise.all([
      tx.minecraftIdentity.findFirst({ where: { userId: accountId, namespace: MINECRAFT_NAMESPACE } }),
      tx.minecraftIdentity.findUnique({ where: { namespace_subject: { namespace: MINECRAFT_NAMESPACE, subject: playerUuid } } }),
    ]);

    // Prevent account hijacking / unauthorized relink. A Minecraft UUID belongs
    // to one website account. Paid entitlements remain owned by the website account.
    if (subjectOwner && subjectOwner.userId !== accountId) {
      throw new BridgeValidationError("Conta/UUID já vinculado; solicite desvinculação autenticada");
    }

    const ownedEntitlementUuids = [...new Set((await tx.vipEntitlement.findMany({
      where: { userId: accountId, minecraftUuid: { not: null } },
      select: { minecraftUuid: true },
    })).map(e => e.minecraftUuid).filter((v): v is string => !!v))];

    if (ownerIdentity && ownerIdentity.subject !== playerUuid) {
      throw new BridgeValidationError("Conta já vinculada a outro jogador; desvinculação segura necessária");
    }
    // Safe relink: if this account already owns paid/linked entitlements for a specific
    // UUID, require relinking to that same UUID to preserve ownership and prevent transfer.
    if (!ownerIdentity && ownedEntitlementUuids.length === 1 && ownedEntitlementUuids[0] !== playerUuid) {
      throw new BridgeValidationError("Para preservar seus benefícios, vincule novamente o mesmo UUID da conta Minecraft.");
    }
    if (!ownerIdentity && ownedEntitlementUuids.length > 1) {
      throw new BridgeValidationError("Vínculo precisa de suporte: múltiplos UUIDs associados a benefícios desta conta.");
    }

    if (ownerIdentity) {
      await tx.minecraftIdentity.update({
        where: { id: ownerIdentity.id },
        data: { lastKnownUsername: nickname, verifiedAt: now, verificationMethod: "ingame_link_code" },
      });
    } else {
      await tx.minecraftIdentity.create({
        data: { userId: accountId, namespace: MINECRAFT_NAMESPACE, subject: playerUuid, lastKnownUsername: nickname, verifiedAt: now, verificationMethod: "ingame_link_code" },
      });
    }

    const consumed = await tx.minecraftLinkCode.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now, consumedUuid: playerUuid, consumedNickname: nickname },
    });
    if (consumed.count !== 1) throw new BridgeValidationError("Código inválido, vencido ou já utilizado");

    // Backfill paid VIP entitlements waiting for link and queue final state.
    await attachLinkedUuidToPendingEntitlements(tx, accountId, playerUuid);
    // Lock entitlement-bearing paid cash orders before recovery so a refund
    // (which also locks the order row) cannot race and have recovery resurrect
    // a delivery after pending credits are cancelled.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE "userId" = ${accountId} AND "cashAmount" > 0 AND status IN ('PAID'::"OrderStatus", 'FULFILLED'::"OrderStatus") FOR UPDATE`;
    // Recover Cash deliveries for confirmed payments that could not be queued
    // while the account had no verified Minecraft UUID (e.g. unlink before
    // webhook confirmation). Stable cash delivery IDs keep this idempotent and
    // never resurrect refunded deliveries.
    await recoverPendingCashDeliveriesForAccount(tx, accountId);
    await queueVipSnapshot(tx, accountId, now);
    return { accountId };
  });
}

async function attachLinkedUuidToPendingEntitlements(tx: Db, userId: string, uuid: string): Promise<void> {
  await tx.vipEntitlement.updateMany({
    where: { userId, minecraftUuid: null, status: "ACTIVE" },
    data: { minecraftUuid: uuid },
  });
}

export async function listPendingBridgeDeliveries(db: Db, serverId: string, limit = 80) {
  const take = Math.max(1, Math.min(PENDING_LIMIT_MAX, limit));
  const rows = await db.bridgeDelivery.findMany({
    where: { status: "PENDING", kind: { in: ["VIP", "CASH"] } },
    orderBy: [{ accountId: "asc" }, { sequence: "asc" }],
    take,
  });
  // Validate UUID/account binding at read time as defense in depth.
  const accountIds = [...new Set(rows.map(r => r.accountId))];
  const identities = accountIds.length ? await db.minecraftIdentity.findMany({
    where: { userId: { in: accountIds }, namespace: MINECRAFT_NAMESPACE },
    select: { userId: true, subject: true },
  }) : [];
  const byAccount = new Map(identities.map(i => [i.userId, i.subject]));
  const deliveries = rows.flatMap(r => {
    const linked = byAccount.get(r.accountId);
    if (!linked || linked !== r.playerUuid) return [];
    return [{
      deliveryId: r.deliveryId, accountId: r.accountId, playerUuid: r.playerUuid,
      kind: r.kind, action: r.action, vip: r.vip, cashAmount: r.cashAmount,
      expiresAt: r.expiresAt ? isoUtc(r.expiresAt) : null, sequence: Number(r.sequence),
    }];
  });
  return { deliveries };
}

export type AckResult = { ok: true; duplicate?: boolean; httpStatus: 200 | 409 };
export async function acknowledgeBridgeDelivery(db: Db, input: { deliveryId: string; sequence: number; status: string; serverId: string }, now = new Date()): Promise<AckResult> {
  if (input.status !== "completed") throw new BridgeValidationError("ACK inválido");
  if (!/^[A-Za-z0-9_.:-]{1,191}$/.test(input.deliveryId)) throw new BridgeValidationError("Delivery ID ou sequência inválida");
  if (!Number.isSafeInteger(input.sequence) || input.sequence <= 0) throw new BridgeValidationError("Delivery ID ou sequência inválida");
  const updated = await db.bridgeDelivery.updateMany({
    where: { deliveryId: input.deliveryId, sequence: BigInt(input.sequence), status: "PENDING", kind: { in: ["VIP", "CASH"] } },
    data: { status: "ACKED", ackedAt: now, serverId: input.serverId },
  });
  if (updated.count !== 1) {
    const row = await db.bridgeDelivery.findUnique({ where: { deliveryId: input.deliveryId }, select: { status: true, sequence: true } });
    // Only a confirmed duplicate ACK (same delivery, same sequence, already ACKED) is treated as success.
    // All other conflicts (missing, wrong sequence, superseded/cancelled/non-pending) are failures so the
    // plugin does not mark local journal state as safely acknowledged.
    if (row?.status === "ACKED" && row.sequence === BigInt(input.sequence)) return { ok: true, duplicate: true, httpStatus: 409 };
    throw new BridgeValidationError("Delivery ID ou sequência inválida");
  }
  return { ok: true, httpStatus: 200 };
}

export async function getBridgeLinkStatus(db: Db, input: { accountId?: string; playerUuid?: string }, now = new Date()) {
  const accountId = input.accountId?.trim();
  const playerUuid = input.playerUuid ? normalizeUuid(input.playerUuid) : null;
  if (input.playerUuid && !playerUuid) throw new BridgeValidationError("UUID inválido");
  if (!accountId && !playerUuid) throw new BridgeValidationError("accountId ou playerUuid é obrigatório");
  const identity = accountId
    ? await db.minecraftIdentity.findFirst({ where: { userId: accountId, namespace: MINECRAFT_NAMESPACE } })
    : await db.minecraftIdentity.findUnique({ where: { namespace_subject: { namespace: MINECRAFT_NAMESPACE, subject: playerUuid! } } });
  if (!identity) return { linked: false as const };
  const entitlements = await db.vipEntitlement.findMany({
    where: { userId: identity.userId },
    select: { rankSlug: true, expiresAt: true, status: true },
  });
  for (const e of entitlements) {
    if (e.status === "ACTIVE" && e.expiresAt.getTime() <= now.getTime()) {
      await db.vipEntitlement.updateMany({ where: { userId: identity.userId, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED" } });
      break;
    }
  }
  const fresh = await db.vipEntitlement.findMany({ where: { userId: identity.userId }, select: { rankSlug: true, expiresAt: true, status: true } });
  const snapshot = selectActiveVipSnapshot(fresh, now);
  return {
    linked: true as const,
    accountId: identity.userId,
    playerUuid: identity.subject,
    nickname: identity.lastKnownUsername,
    vip: snapshot ? { rank: snapshot.rank, expiresAt: isoUtc(snapshot.expiresAt) } : null,
  };
}

export async function upsertVipEntitlementForPaidOrder(db: Db, order: {
  id: string; userId: string | null; orderNumber: string; rankSlug: string; rankName: string; minecraftUsername: string; totalCents: number; currency: string;
}, fulfillmentId: string, now = new Date()): Promise<{ created: boolean; skipped: boolean; reason?: string }> {
  if (!order.userId) return { created: false, skipped: true, reason: "NO_USER" };
  if (!isVipRank(order.rankSlug)) return { created: false, skipped: true, reason: "NOT_VIP" };
  if (order.totalCents <= 0) return { created: false, skipped: true, reason: "INVALID_AMOUNT" };
  const rank = order.rankSlug as VipRankSlug;
  const identity = await db.minecraftIdentity.findFirst({ where: { userId: order.userId, namespace: MINECRAFT_NAMESPACE } });
  try {
    await db.vipEntitlement.create({
      data: {
        userId: order.userId, orderId: order.id, fulfillmentId, rankSlug: rank,
        minecraftUuid: identity?.subject ?? null,
        minecraftUsername: identity?.lastKnownUsername ?? order.minecraftUsername.slice(0, 64),
        startsAt: now, expiresAt: absoluteVipExpiry(now, VIP_DAYS), status: "ACTIVE",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { created: false, skipped: false };
    throw e;
  }
  // Only queue a bridge snapshot when a verified linked UUID exists; unlinked
  // entitlements are activated on authenticated bind (which preserves ownership).
  if (identity?.subject) await queueVipSnapshot(db, order.userId, now);
  return { created: true, skipped: false };
}

export async function revokeVipEntitlementsForOrder(db: Db, orderId: string, reason = "REFUNDED", now = new Date()): Promise<void> {
  const ents = await db.vipEntitlement.findMany({ where: { orderId, status: "ACTIVE" } });
  if (!ents.length) return;
  await db.vipEntitlement.updateMany({
    where: { orderId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now, revokeReason: reason.slice(0, 64) },
  });
  for (const accountId of new Set(ents.map(e => e.userId))) {
    await queueVipSnapshot(db, accountId, now);
  }
}

async function recoverPendingCashDeliveriesForAccount(tx: Db, accountId: string): Promise<void> {
  return tx.order.findMany({
    where: {
      userId: accountId,
      cashAmount: { gt: 0 },
      status: { in: [OrderStatus.PAID, OrderStatus.FULFILLED] },
    },
    select: { id: true, userId: true, cashAmount: true },
  }).then(async (orders) => {
    for (const order of orders) {
      await queueCashForPaidOrder(tx, order);
    }
  });
}

/** Called within the payment transaction. Stable delivery ID deduplicates retries. */
export async function queueCashForPaidOrder(db: Db, order: { id: string; userId: string | null; cashAmount: number }): Promise<void> {
  if (!order.userId || order.cashAmount <= 0) throw new BridgeValidationError("Cash sem destinatário");
  const identity = await db.minecraftIdentity.findFirst({ where: { userId: order.userId, namespace: MINECRAFT_NAMESPACE } });
  if (!identity?.subject) throw new BridgeValidationError("Conta Minecraft não vinculada");
  const deliveryId = `cash_${order.id}`;
  if (await db.bridgeDelivery.findUnique({ where: { deliveryId } })) return;
  await db.bridgeDelivery.create({ data: {
    deliveryId, orderId: order.id, accountId: order.userId, playerUuid: identity.subject,
    kind: "CASH", action: "CREDIT", cashAmount: order.cashAmount,
    sequence: await nextSequence(db, order.userId), status: "PENDING",
  } });
}
