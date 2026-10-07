import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  OrderStatus,
  PaymentEventStatus,
  PaymentStatus,
  Prisma,
  type PrismaClient,
} from "@prisma/client";

import type {
  MercadoPagoReconciliationClient,
  MercadoPagoReconciliationOrder,
} from "@/lib/payments/mercado-pago";

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;
const SIGNATURE_PART_PATTERN = /^[a-fA-F0-9]{64}$/;
const TIMESTAMP_PATTERN = /^\d{10,17}$/;

export type MercadoPagoWebhookEnvelope = {
  action: string;
  type: "order";
  data: { id: string };
};

export type MercadoPagoWebhookMetadata = {
  providerOrderId: string;
  requestId: string;
  signature: string;
};

export class WebhookPermanentError extends Error {
  constructor(public readonly code: string) {
    super("Webhook cannot be reconciled.");
    this.name = "WebhookPermanentError";
  }
}

export function parseMercadoPagoWebhookEnvelope(value: unknown): MercadoPagoWebhookEnvelope | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.type !== "order" || typeof body.action !== "string" || body.action.length > 100) return null;
  if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) return null;
  const data = body.data as Record<string, unknown>;
  if (typeof data.id !== "string" || !RESOURCE_ID_PATTERN.test(data.id)) return null;
  return { action: body.action, type: "order", data: { id: data.id } };
}

function signatureParts(value: string): { timestamp: string; digest: string } | null {
  if (value.length > 512) return null;
  let timestamp: string | undefined;
  let digest: string | undefined;

  for (const part of value.split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) return null;
    const key = part.slice(0, separator).trim();
    const item = part.slice(separator + 1).trim();
    if (key === "ts") {
      if (timestamp !== undefined) return null;
      timestamp = item;
    } else if (key === "v1") {
      if (digest !== undefined) return null;
      digest = item;
    }
  }

  return timestamp && TIMESTAMP_PATTERN.test(timestamp) && digest && SIGNATURE_PART_PATTERN.test(digest)
    ? { timestamp, digest: digest.toLowerCase() }
    : null;
}

export function verifyMercadoPagoSignature(
  metadata: MercadoPagoWebhookMetadata,
  webhookSecret: string,
): boolean {
  if (!RESOURCE_ID_PATTERN.test(metadata.providerOrderId) || !REQUEST_ID_PATTERN.test(metadata.requestId)) {
    return false;
  }
  const parts = signatureParts(metadata.signature);
  if (!parts) return false;
  const manifest = `id:${metadata.providerOrderId.toLowerCase()};request-id:${metadata.requestId};ts:${parts.timestamp};`;
  const expected = createHmac("sha256", webhookSecret).update(manifest).digest();
  const received = Buffer.from(parts.digest, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function decimalToCents(value: string): number | null {
  const match = /^(0|[1-9]\d{0,12})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

function mappedStatus(order: MercadoPagoReconciliationOrder): PaymentStatus {
  if (order.status === "processed" && order.statusDetail === "accredited") return PaymentStatus.APPROVED;
  if (order.status === "refunded" || order.statusDetail === "refunded") return PaymentStatus.REFUNDED;
  if (order.status === "canceled") return PaymentStatus.CANCELLED;
  if (order.status === "failed") return PaymentStatus.REJECTED;
  return PaymentStatus.PENDING;
}

function nextOrderStatus(current: OrderStatus, payment: PaymentStatus): OrderStatus {
  if (payment === PaymentStatus.REFUNDED && (current === OrderStatus.PAID || current === OrderStatus.FULFILLED)) {
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

function deduplicationKey(metadata: MercadoPagoWebhookMetadata, eventType: string): string {
  return createHash("sha256")
    .update(`mercado-pago\0${eventType}\0${metadata.providerOrderId}\0${metadata.requestId}`)
    .digest("hex");
}

export async function reconcileMercadoPagoWebhook(
  db: PrismaClient,
  provider: MercadoPagoReconciliationClient,
  envelope: MercadoPagoWebhookEnvelope,
  metadata: MercadoPagoWebhookMetadata,
  now = new Date(),
): Promise<"processed" | "duplicate" | "ignored"> {
  const key = deduplicationKey(metadata, envelope.action);
  try {
    await db.paymentEvent.create({
      data: {
        deduplicationKey: key,
        providerEventId: metadata.requestId,
        providerResourceId: metadata.providerOrderId,
        eventType: envelope.action,
        signatureValid: true,
        payload: { type: envelope.type, action: envelope.action, data: { id: envelope.data.id } },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.paymentEvent.findUnique({ where: { deduplicationKey: key } });
      if (existing?.status !== PaymentEventStatus.RETRY_PENDING) return "duplicate";
      const claimed = await db.paymentEvent.updateMany({
        where: { id: existing.id, status: PaymentEventStatus.RETRY_PENDING },
        data: { status: PaymentEventStatus.PROCESSING },
      });
      if (claimed.count !== 1) return "duplicate";
    } else {
      throw error;
    }
  }

  let remote: MercadoPagoReconciliationOrder;
  try {
    remote = await provider.getOrder(metadata.providerOrderId);
  } catch (error) {
    await db.paymentEvent.update({
      where: { deduplicationKey: key },
      data: { status: PaymentEventStatus.RETRY_PENDING, attemptCount: { increment: 1 }, lastErrorCode: "PROVIDER_UNAVAILABLE" },
    });
    throw error;
  }

  const payment = await db.payment.findUnique({
    where: { providerOrderId: metadata.providerOrderId },
    include: { order: true },
  });
  const amountCents = decimalToCents(remote.totalAmount);
  let mismatch: string | null = null;
  if (remote.id !== metadata.providerOrderId) mismatch = "PROVIDER_ORDER_ID_MISMATCH";
  else if (!payment || payment.providerOrderId !== remote.id) mismatch = "PAYMENT_NOT_FOUND";
  else if (remote.externalReference !== payment.order.orderNumber) mismatch = "EXTERNAL_REFERENCE_MISMATCH";
  else if (amountCents === null || amountCents !== payment.amountCents || amountCents !== payment.order.totalCents) mismatch = "AMOUNT_MISMATCH";
  else if (remote.currency !== payment.currency || remote.currency !== payment.order.currency) mismatch = "CURRENCY_MISMATCH";

  if (mismatch) {
    await db.$transaction(async (tx) => {
      if (payment) {
        if (payment.order.status !== OrderStatus.PAID && payment.order.status !== OrderStatus.FULFILLED) {
          await tx.order.update({ where: { id: payment.orderId }, data: { status: OrderStatus.REVIEW_REQUIRED } });
        }
      }
      await tx.paymentEvent.update({
        where: { deduplicationKey: key },
        data: { status: PaymentEventStatus.DEAD_LETTER, processedAt: now, attemptCount: { increment: 1 }, lastErrorCode: mismatch },
      });
    });
    return "ignored";
  }

  const verifiedPayment = payment!;
  const status = mappedStatus(remote);
  const orderStatus = nextOrderStatus(verifiedPayment.order.status, status);
  const protectsApprovedPayment = verifiedPayment.status === PaymentStatus.APPROVED && (
    status === PaymentStatus.PENDING ||
    status === PaymentStatus.REJECTED ||
    status === PaymentStatus.CANCELLED
  );

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: verifiedPayment.id },
      data: {
        status: protectsApprovedPayment ? PaymentStatus.APPROVED : status,
        providerPaymentId: remote.paymentId ?? verifiedPayment.providerPaymentId,
        providerStatus: remote.status,
        providerStatusDetail: remote.statusDetail,
        paymentMethod: remote.paymentMethod,
        amountCents,
        currency: remote.currency,
        approvedAt: status === PaymentStatus.APPROVED ? (verifiedPayment.approvedAt ?? now) : verifiedPayment.approvedAt,
        lastSyncedAt: now,
      },
    });
    if (orderStatus !== verifiedPayment.order.status) {
      await tx.order.update({
        where: { id: verifiedPayment.orderId },
        data: {
          status: orderStatus,
          paidAt: orderStatus === OrderStatus.PAID ? (verifiedPayment.order.paidAt ?? now) : verifiedPayment.order.paidAt,
        },
      });
    }
    await tx.paymentEvent.update({
      where: { deduplicationKey: key },
      data: { status: PaymentEventStatus.PROCESSED, processedAt: now, attemptCount: { increment: 1 }, lastErrorCode: null },
    });
  });

  return "processed";
}
