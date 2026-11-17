import "server-only";

import { createHash } from "node:crypto";
import { OrderStatus, PaymentProvider, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
import { isStripeCheckoutUrl } from "./stripe-url";

const STRIPE_CHECKOUT_URL = "https://api.stripe.com/v1/checkout/sessions";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

export type StripeCheckoutSessionResult = {
  providerOrderId: string;
  checkoutUrl: string;
  providerStatus: string | null;
};

export type StripeCheckoutClient = {
  createCheckoutSession(
    request: StripeCheckoutSessionRequest,
    idempotencyKey: string,
  ): Promise<StripeCheckoutSessionResult>;
};

export type StripeCheckoutSessionRequest = {
  mode: "payment" | "subscription";
  lineItems: Array<{
    name: string;
    unitAmountCents: number;
    currency: string;
    quantity: number;
    recurring?: { interval: string };
  }>;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
  clientReferenceId: string;
  expiresAt: number;
};

export class StripeUnavailableError extends Error {
  constructor() {
    super("Stripe checkout session creation is unavailable.");
    this.name = "StripeUnavailableError";
  }
}

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
  const hex = createHash("sha256").update(`stripe-checkout:${orderId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function returnUrl(appUrl: URL, result: "success" | "cancel", orderNumber: string): string {
  const url = new URL(`/checkout/return/${result}`, appUrl);
  url.searchParams.set("order", orderNumber);
  return url.toString();
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

async function boundedJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw new StripeUnavailableError();
  const responseBody = await response.text();
  if (new TextEncoder().encode(responseBody).byteLength > MAX_RESPONSE_BYTES) {
    throw new StripeUnavailableError();
  }
  try {
    return JSON.parse(responseBody);
  } catch {
    throw new StripeUnavailableError();
  }
}

function boundedCheckoutSession(value: unknown): StripeCheckoutSessionResult | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  const id = boundedString(session.id, 255);
  const url = boundedString(session.url, 2048);
  const status = typeof session.status === "string" ? session.status.slice(0, 100) : null;

  if (!id || !/^cs_[A-Za-z0-9_]+$/.test(id) || !isStripeCheckoutUrl(url)) return null;

  try {
    new URL(url);
  } catch {
    return null;
  }

  return { providerOrderId: id, checkoutUrl: url, providerStatus: status };
}

export function createStripeCheckoutClient(
  secretKey: string,
  request: typeof fetch = fetch,
): StripeCheckoutClient {
  return {
    async createCheckoutSession(body, idempotencyKey) {
      const result = await createCheckoutSessionRaw(secretKey, body, idempotencyKey, request);
      if (!result) throw new StripeUnavailableError();
      return result;
    },
  };
}

async function createCheckoutSessionRaw(
  secretKey: string,
  body: StripeCheckoutSessionRequest,
  idempotencyKey: string,
  request: typeof fetch,
): Promise<StripeCheckoutSessionResult | null> {
  const formData = new URLSearchParams();
  formData.set("mode", body.mode);
  formData.set("success_url", body.successUrl);
  formData.set("cancel_url", body.cancelUrl);
  formData.set("client_reference_id", body.clientReferenceId);
  formData.set("expires_at", String(body.expiresAt));

  for (const [key, value] of Object.entries(body.metadata)) {
    formData.set(`metadata[${key}]`, value);
    if (body.mode === "payment") formData.set(`payment_intent_data[metadata][${key}]`, value);
  }

  body.lineItems.forEach((item, index) => {
    const prefix = `line_items[${index}]`;
    formData.set(`${prefix}[price_data][currency]`, item.currency);
    formData.set(`${prefix}[price_data][product_data][name]`, item.name);
    formData.set(`${prefix}[price_data][unit_amount]`, String(item.unitAmountCents));
    formData.set(`${prefix}[quantity]`, String(item.quantity));
    if (item.recurring) {
      formData.set(`${prefix}[price_data][recurring][interval]`, item.recurring.interval);
    }
  });

  let response: Response;
  try {
    response = await request(STRIPE_CHECKOUT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "manual",
    });
  } catch {
    return null;
  }

  const resource = await boundedJsonResponse(response);
  if (!resource || typeof resource !== "object" ||
      (resource as Record<string, unknown>).livemode !== /^(sk|rk)_live_/.test(secretKey)) throw new StripeUnavailableError();
  return boundedCheckoutSession(resource);
}

export async function startStripeCheckout(
  db: PrismaClient,
  stripeCheckout: StripeCheckoutClient,
  input: { orderNumber: string; orderToken: string; userId?: string },
  options: { appUrl: URL; now?: Date },
): Promise<{ checkoutUrl: string }> {
  const now = options.now ?? new Date();
  const order = await db.order.findFirst({
    where: { orderNumber: input.orderNumber, publicToken: input.orderToken, ...(input.userId ? { userId: input.userId } : {}) },
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
  if (!Number.isSafeInteger(order.totalCents) || order.totalCents <= 0 || order.currency !== "BRL") throw new OrderNotPayableError();
  let payment = await db.payment.findUnique({ where: { providerIdempotencyKey: idempotencyKey } });
  if (!payment) {
    try {
      payment = await db.payment.create({ data: {
        orderId: order.id, provider: PaymentProvider.STRIPE, status: PaymentStatus.CREATED,
        providerIdempotencyKey: idempotencyKey, amountCents: order.totalCents, currency: order.currency,
      } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      payment = await db.payment.findUniqueOrThrow({ where: { providerIdempotencyKey: idempotencyKey } });
    }
  }
  if (payment.orderId !== order.id || payment.provider !== PaymentProvider.STRIPE || payment.amountCents !== order.totalCents || payment.currency !== order.currency ||
      !([PaymentStatus.CREATED, PaymentStatus.PENDING] as PaymentStatus[]).includes(payment.status)) throw new OrderNotPayableError();
  if (isStripeCheckoutUrl(payment.checkoutUrl)) return { checkoutUrl: payment.checkoutUrl };
  // Stripe requires expiry between 30 minutes and 24 hours. Keep this value
  // stable across retries so the same provider idempotency key has the same body.
  if (order.expiresAt.getTime() - now.getTime() < 30 * 60 * 1000) throw new OrderNotPayableError();
  const mode = "payment";

  const lineItems = [
    {
      name: order.cashAmount > 0 ? order.rankName : `Rank ${order.rankName}`,
      unitAmountCents: order.totalCents,
      currency: order.currency.toLowerCase(),
      quantity: 1,
    },
  ];

  const request: StripeCheckoutSessionRequest = {
    mode,
    lineItems,
    successUrl: returnUrl(options.appUrl, "success", order.orderNumber),
    cancelUrl: returnUrl(options.appUrl, "cancel", order.orderNumber),
    expiresAt: Math.floor(order.expiresAt.getTime() / 1000),
    metadata: {
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      minecraftUsername: order.minecraftUsername,
      paymentId: payment.id,
    },
    clientReferenceId: order.orderNumber,
  };

  const session = await stripeCheckout.createCheckoutSession(request, idempotencyKey);

  if (!isStripeCheckoutUrl(session.checkoutUrl)) {
    throw new StripeUnavailableError();
  }
  const updated = await db.payment.updateMany({
    where: { id: payment.id, providerOrderId: null, checkoutUrl: null },
    data: { providerOrderId: session.providerOrderId, checkoutUrl: session.checkoutUrl, providerStatus: session.providerStatus },
  });
  if (updated.count !== 1) {
    const persisted = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    if (persisted.providerOrderId !== session.providerOrderId || !isStripeCheckoutUrl(persisted.checkoutUrl)) throw new OrderNotPayableError();
    return { checkoutUrl: persisted.checkoutUrl };
  }
  return { checkoutUrl: session.checkoutUrl };
}
