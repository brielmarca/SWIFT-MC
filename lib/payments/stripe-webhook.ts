import "server-only";

import {
  OrderStatus,
  PaymentEventStatus,
  PaymentStatus,
  PaymentProvider,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import type { StripeReconciliationClient } from "@/lib/payments/stripe";
import { StripeUnavailableError } from "@/lib/payments/stripe";
import { createFulfillmentForOrder } from "@/lib/fulfillment/fulfillment-service";
import { isVipRank } from "@/lib/minecraft-bridge/vip";
import { queueCashForPaidOrder, revokeVipEntitlementsForOrder, upsertVipEntitlementForPaidOrder } from "@/lib/minecraft-bridge/service";

const STRIPE_ID_PATTERN = /^[A-Za-z0-9_]{1,255}$/;
const ORDER_NUMBER_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const WEBHOOK_SECRET_MIN_LENGTH = 8;
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

export type StripeWebhookMetadata = {
  eventId: string;
  timestamp: string;
  signature: string;
};

export class StripeWebhookPermanentError extends Error {
  constructor(public readonly code: string) {
    super("Stripe webhook cannot be reconciled.");
    this.name = "StripeWebhookPermanentError";
  }
}

export function parseStripeWebhookEvent(value: unknown): StripeWebhookEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (typeof event.id !== "string" || !STRIPE_ID_PATTERN.test(event.id)) return null;
  if (typeof event.type !== "string" || event.type.length > 100) return null;
  if (!event.data || typeof event.data !== "object" || Array.isArray(event.data)) return null;
  const data = event.data as Record<string, unknown>;
  if (!data.object || typeof data.object !== "object" || Array.isArray(data.object)) return null;
  const object = data.object as Record<string, unknown>;
  if (typeof object.id !== "string" || !STRIPE_ID_PATTERN.test(object.id)) return null;
  return { id: event.id, type: event.type, data: { object: data.object } };
}

export function parseStripeSignature(header: string | null): {
  timestamp: string;
  signature: string;
} | null {
  if (!header || header.length > 1024) return null;
  let timestamp: string | undefined;
  let signature: string | undefined;
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) return null;
    const key = part.slice(0, separator).trim();
    const item = part.slice(separator + 1).trim();
    if (key === "t") {
      if (timestamp !== undefined) return null;
      timestamp = item;
    } else if (key === "v1") {
      if (signature !== undefined) return null;
      signature = item;
    }
  }
  if (!timestamp || !/^\d{10,17}$/.test(timestamp)) return null;
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return null;
  return { timestamp, signature: signature.toLowerCase() };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

async function hmacSha256(secret: string, payload: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyBuffer = encoder.encode(secret);
  const dataBuffer = encoder.encode(payload);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function verifyStripeSignature(
  rawBody: string,
  metadata: StripeWebhookMetadata,
  webhookSecret: string,
): Promise<boolean> {
  if (!webhookSecret || webhookSecret.length < WEBHOOK_SECRET_MIN_LENGTH) return false;
  const parts = parseStripeSignature(
    `t=${metadata.timestamp},v1=${metadata.signature}`,
  );
  if (!parts) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const eventSeconds = Number(parts.timestamp);
  if (Math.abs(nowSeconds - eventSeconds) > TIMESTAMP_TOLERANCE_SECONDS) return false;
  const signedPayload = `${parts.timestamp}.${rawBody}`;
  const expected = await hmacSha256(webhookSecret, signedPayload);
  const received = hexToBytes(parts.signature);
  return constantTimeEqual(received, expected);
}

function eventTypeToAction(eventType: string): string {
  return eventType.replace(/\./g, ":");
}

async function deduplicationKey(eventId: string): Promise<string> {
  return sha256Hex(`stripe\0${eventId}`);
}

function extractOrderNumber(resource: unknown): string | null {
  if (!resource || typeof resource !== "object") return null;
  const obj = resource as Record<string, unknown>;
  const metadata = obj.metadata;
  const metadataOrderNumber =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>).orderNumber
      : undefined;
  if (typeof metadataOrderNumber === "string" && ORDER_NUMBER_PATTERN.test(metadataOrderNumber)) {
    return metadataOrderNumber;
  }
  const clientReferenceId = obj.client_reference_id;
  if (typeof clientReferenceId === "string" && ORDER_NUMBER_PATTERN.test(clientReferenceId)) {
    return clientReferenceId;
  }
  return null;
}

function nextOrderStatus(current: OrderStatus, payment: PaymentStatus): OrderStatus {
  if (payment === PaymentStatus.REFUNDED) {
    return OrderStatus.REFUNDED;
  }
  if (current === OrderStatus.FULFILLED) return current;
  if (current === OrderStatus.PAID || current === OrderStatus.REFUNDED) return current;
  if (payment === PaymentStatus.APPROVED) return OrderStatus.PAID;
  if (payment === PaymentStatus.REJECTED || payment === PaymentStatus.CANCELLED) {
    return current === OrderStatus.PENDING_PAYMENT ? OrderStatus.PAYMENT_FAILED : current;
  }
  return current;
}

function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === OrderStatus.PAID || status === OrderStatus.FULFILLED || status === OrderStatus.REFUNDED;
}

async function recordPermanentMismatch(
  tx: PrismaClient,
  key: string,
  now: Date,
  payment: { id: string; orderId: string; order: { status: OrderStatus } } | null,
  code: string,
): Promise<void> {
  if (payment && !isTerminalOrderStatus(payment.order.status)) {
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.REVIEW_REQUIRED },
    });
  }
  await tx.paymentEvent.update({
    where: { deduplicationKey: key },
    data: {
      status: PaymentEventStatus.DEAD_LETTER,
      processedAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: code,
    },
  });
}

export async function reconcileStripeWebhook(
  db: PrismaClient,
  stripe: StripeReconciliationClient,
  event: StripeWebhookEvent,
  metadata: StripeWebhookMetadata,
  now = new Date(),
): Promise<"processed" | "duplicate" | "ignored"> {
  // Serialize redeliveries; all event/payment/order/fulfillment writes commit
  // together. Unexpected failures roll back so Stripe can safely retry.
  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT count(*)::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${event.id}, 0))) AS lock`;
    try { return await reconcileInTransaction(tx as unknown as PrismaClient, stripe, event, now); }
    catch (error) {
      // Keep the retry marker on provider outages, but never partial payment writes.
      if (error instanceof StripeUnavailableError) return "unavailable" as const;
      throw error;
    }
  }, { timeout: 20000 });
  if (result === "unavailable") throw new StripeUnavailableError();
  return result;
}

async function reconcileInTransaction(
  db: PrismaClient, stripe: StripeReconciliationClient, event: StripeWebhookEvent, now: Date,
): Promise<"processed" | "duplicate" | "ignored"> {
  const key = await deduplicationKey(event.id);
  const previous = await db.paymentEvent.findUnique({ where: { deduplicationKey: key } });
  if (previous && previous.status !== PaymentEventStatus.RETRY_PENDING) return "duplicate";
  if (!previous) {
    await db.paymentEvent.create({
      data: {
        deduplicationKey: key,
        provider: PaymentProvider.STRIPE,
        providerEventId: event.id,
        providerResourceId: event.id,
        eventType: eventTypeToAction(event.type),
        signatureValid: true,
        payload: {
          type: event.type,
          data: { object: event.data.object as Record<string, unknown> },
        } as Prisma.InputJsonValue,
      },
    });
  }

  const acceptedTypes = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
    "charge.refunded",
  ]);
  if (!acceptedTypes.has(event.type)) {
    await db.paymentEvent.update({
      where: { deduplicationKey: key },
      data: {
        status: PaymentEventStatus.IGNORED,
        processedAt: now,
        attemptCount: { increment: 1 },
      },
    });
    return "ignored";
  }

  let orderNumber: string | null = null;
  let paymentStatus: PaymentStatus;
  let remoteAmountCents: number | null = null;
  let remoteCurrency: string | null = null;
  let sessionId: string | null = null;
  let paymentId: string | null = null;
  let paymentIntent: string | null = null;

  const resource = event.data.object as { id: string };

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = await stripe.getCheckoutSession(resource.id);
        if (!session) {
          await recordPermanentMismatch(db, key, now, null, "RESOURCE_NOT_FOUND");
          return "ignored";
        }
        orderNumber = extractOrderNumber(session);
        sessionId = session.id;
        paymentId = session.metadata.paymentId ?? null;
        paymentIntent = session.payment_intent;
        if (session.id !== resource.id || session.client_reference_id !== orderNumber || session.amount_total === null || !Number.isSafeInteger(session.amount_total) || session.amount_total <= 0 || !session.currency) {
          await recordPermanentMismatch(db, key, now, null, "INVALID_SESSION");
          return "ignored";
        }
        if (session.payment_status !== "paid") {
          await recordPermanentMismatch(db, key, now, null, "PAYMENT_NOT_PAID");
          return "ignored";
        }
        paymentStatus = PaymentStatus.APPROVED;
        remoteAmountCents = session.amount_total ?? null;
        remoteCurrency = session.currency ?? null;
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        const session = await stripe.getCheckoutSession(resource.id);
        if (!session) {
          await recordPermanentMismatch(db, key, now, null, "RESOURCE_NOT_FOUND");
          return "ignored";
        }
        orderNumber = extractOrderNumber(session);
        sessionId = session.id;
        paymentId = session.metadata.paymentId ?? null;
        paymentIntent = session.payment_intent;
        if (session.id !== resource.id || session.client_reference_id !== orderNumber || session.payment_status === "paid" ||
            (event.type === "checkout.session.expired" && session.status !== "expired")) {
          await recordPermanentMismatch(db, key, now, null, "INVALID_SESSION_STATE");
          return "ignored";
        }
        paymentStatus = event.type === "checkout.session.expired" ? PaymentStatus.CANCELLED : PaymentStatus.REJECTED;
        remoteAmountCents = session.amount_total ?? null;
        remoteCurrency = session.currency ?? null;
        break;
      }
      case "charge.refunded": {
        const charge = await stripe.getCharge(resource.id);
        if (!charge) {
          await recordPermanentMismatch(db, key, now, null, "RESOURCE_NOT_FOUND");
          return "ignored";
        }
        orderNumber = extractOrderNumber(charge);
        paymentId = charge.metadata.paymentId ?? null;
        paymentIntent = charge.payment_intent;
        if (charge.id !== resource.id || !charge.refunded || !Number.isSafeInteger(charge.amount) || charge.amount <= 0) {
          await recordPermanentMismatch(db, key, now, null, "REFUND_REQUIRES_REVIEW");
          return "ignored";
        }
        paymentStatus = PaymentStatus.REFUNDED;
        remoteAmountCents = charge.amount;
        remoteCurrency = charge.currency ?? null;
        break;
      }
      default:
        paymentStatus = PaymentStatus.PENDING;
    }
  } catch (error) {
    if (error instanceof StripeUnavailableError) {
      await db.paymentEvent.update({
        where: { deduplicationKey: key },
        data: {
          status: PaymentEventStatus.RETRY_PENDING,
          attemptCount: { increment: 1 },
          lastErrorCode: "PROVIDER_UNAVAILABLE",
        },
      });
      throw error;
    }
    throw error;
  }

  if (!orderNumber) {
    await db.paymentEvent.update({
      where: { deduplicationKey: key },
      data: {
        status: PaymentEventStatus.IGNORED,
        processedAt: now,
        attemptCount: { increment: 1 },
        lastErrorCode: "ORDER_NOT_MAPPED",
      },
    });
    return "ignored";
  }

  const paymentScope = sessionId
    ? [{ providerOrderId: sessionId }, ...(paymentId ? [{ id: paymentId, providerOrderId: null }] : [])]
    : [...(paymentId ? [{ id: paymentId }] : []), ...(paymentIntent ? [{ providerPaymentId: paymentIntent }] : [])];
  let payment = await db.payment.findFirst({
    where: { order: { orderNumber }, ...(paymentScope.length > 0 ? { OR: paymentScope } : {}) },
    include: { order: true },
  });
  if (payment) {
    await db.$queryRaw`SELECT id FROM "Order" WHERE id = ${payment.orderId} FOR UPDATE`;
    payment = await db.payment.findUnique({ where: { id: payment.id }, include: { order: true } });
  }

  let mismatch: string | null = null;
  if (!payment) mismatch = "PAYMENT_NOT_FOUND";
  else if (payment.provider !== PaymentProvider.STRIPE) mismatch = "WRONG_PROVIDER";
  else if (paymentId && payment.id !== paymentId) mismatch = "PAYMENT_ID_MISMATCH";
  else if (paymentIntent && payment.providerPaymentId && payment.providerPaymentId !== paymentIntent) mismatch = "PAYMENT_INTENT_MISMATCH";
  else if (remoteAmountCents !== null && remoteAmountCents !== payment.order.totalCents) mismatch = "AMOUNT_MISMATCH";
  else if (remoteAmountCents !== null && payment.amountCents !== null && remoteAmountCents !== payment.amountCents) mismatch = "AMOUNT_MISMATCH";
  else if (remoteCurrency !== null && payment.currency !== null && remoteCurrency.toUpperCase() !== payment.currency.toUpperCase()) mismatch = "CURRENCY_MISMATCH";

  if (mismatch) {
    await recordPermanentMismatch(db, key, now, payment, mismatch);
    return "ignored";
  }

  const verifiedPayment = payment!;
  const orderStatus = event.type === "checkout.session.expired" && verifiedPayment.order.status === OrderStatus.PENDING_PAYMENT
    ? OrderStatus.EXPIRED : nextOrderStatus(verifiedPayment.order.status, paymentStatus);
  if (verifiedPayment.order.status === OrderStatus.REFUNDED && paymentStatus !== PaymentStatus.REFUNDED) {
    await db.paymentEvent.update({ where: { deduplicationKey: key }, data: { status: PaymentEventStatus.IGNORED, processedAt: now } });
    return "ignored";
  }
  const protectsApprovedPayment = verifiedPayment.status === PaymentStatus.APPROVED && (
    paymentStatus === PaymentStatus.PENDING ||
    paymentStatus === PaymentStatus.REJECTED ||
    paymentStatus === PaymentStatus.CANCELLED
  );

  await db.payment.update({
    where: { id: verifiedPayment.id },
    data: {
      status: protectsApprovedPayment ? PaymentStatus.APPROVED : paymentStatus,
      providerStatus: event.type,
      ...(sessionId ? { providerOrderId: sessionId } : {}),
      ...(paymentIntent ? { providerPaymentId: paymentIntent } : {}),
      providerStatusDetail: null,
      amountCents: remoteAmountCents ?? verifiedPayment.amountCents,
      currency: remoteCurrency?.toUpperCase() ?? verifiedPayment.currency,
      approvedAt:
        paymentStatus === PaymentStatus.APPROVED
          ? verifiedPayment.approvedAt ?? now
          : verifiedPayment.approvedAt,
      lastSyncedAt: now,
    },
  });
  let orderStatusChanged = false;
  if (orderStatus !== verifiedPayment.order.status) {
    await db.order.update({
      where: { id: verifiedPayment.orderId },
      data: {
        status: orderStatus,
        paidAt:
          orderStatus === OrderStatus.PAID
            ? verifiedPayment.order.paidAt ?? now
            : verifiedPayment.order.paidAt,
      },
    });
    orderStatusChanged = true;
  }

  // All delivery writes share the payment transaction; provider retries cannot double-credit.
  if (orderStatusChanged && orderStatus === OrderStatus.PAID) {
    const order = verifiedPayment.order;
    if (order.cashAmount > 0) await queueCashForPaidOrder(db, order);
    if (isVipRank(order.rankSlug)) {
      let fulfillment = await db.fulfillment.findUnique({ where: { orderId: verifiedPayment.orderId } });
      if (!fulfillment) {
        const created = await createFulfillmentForOrder(db as unknown as PrismaClient, {
          id: order.id, orderNumber: order.orderNumber, rankSlug: order.rankSlug, rankName: order.rankName,
          minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency,
        }, "rank");
        fulfillment = created.fulfillment;
      }
      if (order.userId) {
        await upsertVipEntitlementForPaidOrder(db as unknown as PrismaClient, {
          id: order.id, userId: order.userId, orderNumber: order.orderNumber, rankSlug: order.rankSlug,
          rankName: order.rankName, minecraftUsername: order.minecraftUsername, totalCents: order.totalCents, currency: order.currency,
        }, fulfillment.id, now);
      }
    }
  }

  if (orderStatusChanged && orderStatus === OrderStatus.REFUNDED) {
    // The plugin cannot debit Cash. Cancel pending credits and retain acknowledged
    // deliveries for manual refund reconciliation; never send a negative credit.
    await db.bridgeDelivery.updateMany({ where: { orderId: verifiedPayment.orderId, kind: "CASH", status: "PENDING" }, data: { status: "CANCELLED_REFUND" } });
    await revokeVipEntitlementsForOrder(db as unknown as PrismaClient, verifiedPayment.orderId, "REFUNDED", now);
  }

  await db.paymentEvent.update({
    where: { deduplicationKey: key },
    data: {
      status: PaymentEventStatus.PROCESSED,
      processedAt: now,
      attemptCount: { increment: 1 },
      lastErrorCode: null,
    },
  });
  return "processed";
}
