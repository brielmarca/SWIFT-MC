import "server-only";

import { createHash } from "node:crypto";
import { OrderStatus, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";

import {
  formatCentsAsDecimal,
  isValidMercadoPagoCheckoutUrl,
  type MercadoPagoOrderRequest,
  type MercadoPagoOrdersClient,
} from "@/lib/payments/mercado-pago";

export type PaymentCheckout = {
  checkoutUrl: string;
};

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found.");
    this.name = "OrderNotFoundError";
  }
}

export class OrderNotPayableError extends Error {
  constructor() {
    super("Order is not payable.");
    this.name = "OrderNotPayableError";
  }
}

function providerIdempotencyKey(orderId: string): string {
  const hex = createHash("sha256").update(`mercado-pago-order:${orderId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function isValidExternalReference(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function returnUrl(appUrl: URL, result: "success" | "pending" | "failure"): string {
  return new URL(`/checkout/return/${result}`, appUrl).toString();
}

export async function startOrderPayment(
  db: PrismaClient,
  mercadoPago: MercadoPagoOrdersClient,
  input: { orderNumber: string; orderToken: string },
  options: { appUrl: URL; now?: Date },
): Promise<PaymentCheckout> {
  const now = options.now ?? new Date();
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, publicToken: input.orderToken },
  });

  if (!order) throw new OrderNotFoundError();
  if (
    order.status !== OrderStatus.PENDING_PAYMENT ||
    order.paidAt !== null ||
    order.expiresAt.getTime() <= now.getTime()
  ) {
    throw new OrderNotPayableError();
  }

  const idempotencyKey = providerIdempotencyKey(order.id);
  let payment = await db.payment.findUnique({ where: { providerIdempotencyKey: idempotencyKey } });

  if (
    payment &&
    (payment.orderId !== order.id ||
      payment.amountCents !== order.totalCents ||
      payment.currency !== order.currency)
  ) {
    throw new OrderNotPayableError();
  }

  if (payment?.checkoutUrl && isValidMercadoPagoCheckoutUrl(payment.checkoutUrl)) {
    return { checkoutUrl: payment.checkoutUrl };
  }

  if (!payment) {
    try {
      payment = await db.payment.create({
        data: {
          orderId: order.id,
          status: PaymentStatus.CREATED,
          providerIdempotencyKey: idempotencyKey,
          amountCents: order.totalCents,
          currency: order.currency,
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      payment = await db.payment.findUnique({ where: { providerIdempotencyKey: idempotencyKey } });
      if (!payment) throw error;
      if (payment.checkoutUrl && isValidMercadoPagoCheckoutUrl(payment.checkoutUrl)) {
        return { checkoutUrl: payment.checkoutUrl };
      }
    }
  }

  const amount = formatCentsAsDecimal(order.totalCents);
  const request: MercadoPagoOrderRequest = {
    type: "online",
    processing_mode: "manual",
    total_amount: amount,
    ...(isValidExternalReference(order.orderNumber)
      ? { external_reference: order.orderNumber }
      : {}),
    payer: { email: order.email },
    items: [
      {
        title: `Rank ${order.rankName}`,
        quantity: 1,
        unit_price: amount,
        unit_measure: "unit",
        total_amount: amount,
        external_code: order.rankSlug,
      },
    ],
    config: {
      online: {
        success_url: returnUrl(options.appUrl, "success"),
        pending_url: returnUrl(options.appUrl, "pending"),
        failure_url: returnUrl(options.appUrl, "failure"),
        auto_return: "all",
      },
    },
  };
  const providerOrder = await mercadoPago.createOrder(request, idempotencyKey);

  if (!isValidMercadoPagoCheckoutUrl(providerOrder.checkoutUrl)) {
    throw new Error("Invalid provider checkout URL.");
  }

  const updated = await db.payment.updateMany({
    where: {
      id: payment.id,
      providerOrderId: null,
      checkoutUrl: null,
      order: {
        status: OrderStatus.PENDING_PAYMENT,
        paidAt: null,
        expiresAt: { gt: now },
      },
    },
    data: {
      providerOrderId: providerOrder.providerOrderId,
      checkoutUrl: providerOrder.checkoutUrl,
      providerStatus: providerOrder.providerStatus,
      providerStatusDetail: providerOrder.providerStatusDetail,
    },
  });

  if (updated.count !== 1) {
    const concurrentPayment = await db.payment.findUnique({ where: { id: payment.id } });
    if (concurrentPayment?.checkoutUrl && isValidMercadoPagoCheckoutUrl(concurrentPayment.checkoutUrl)) {
      return { checkoutUrl: concurrentPayment.checkoutUrl };
    }

    throw new OrderNotPayableError();
  }

  return { checkoutUrl: providerOrder.checkoutUrl };
}
