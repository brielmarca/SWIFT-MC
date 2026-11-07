import "server-only";

import { createHash } from "node:crypto";
import { OrderStatus, type PrismaClient } from "@prisma/client";

import { getStripeConfig } from "@/lib/server-env";

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

function returnUrl(appUrl: URL, result: "success" | "pending" | "failure"): string {
  return new URL(`/checkout/return/${result}`, appUrl).toString();
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

  if (!id || !url) return null;

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

  for (const [key, value] of Object.entries(body.metadata)) {
    formData.set(`metadata[${key}]`, value);
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
    });
  } catch {
    return null;
  }

  return boundedCheckoutSession(await boundedJsonResponse(response));
}

function isValidStripeSecretKey(value: string): boolean {
  return /^(sk|rk)_(live|test)_/.test(value);
}

export async function startStripeCheckout(
  db: PrismaClient,
  stripeCheckout: StripeCheckoutClient,
  input: { orderNumber: string; orderToken: string },
  options: { appUrl: URL; now?: Date },
): Promise<{ checkoutUrl: string }> {
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
  const config = getStripeConfig();

  if (!isValidStripeSecretKey(config.secretKey)) {
    throw new StripeUnavailableError();
  }

  const isSubscription = order.rankDuration.toLowerCase().includes("mensal") || order.rankDuration.toLowerCase().includes("monthly");
  const mode: "payment" | "subscription" = isSubscription ? "subscription" : "payment";

  const lineItems = [
    {
      name: `Rank ${order.rankName}`,
      unitAmountCents: order.totalCents,
      currency: order.currency,
      quantity: 1,
      ...(mode === "subscription" ? { recurring: { interval: "month" } } : {}),
    },
  ];

  const request: StripeCheckoutSessionRequest = {
    mode,
    lineItems,
    successUrl: returnUrl(options.appUrl, "success"),
    cancelUrl: returnUrl(options.appUrl, "failure"),
    metadata: {
      orderNumber: order.orderNumber,
      rankSlug: order.rankSlug,
      minecraftUsername: order.minecraftUsername,
    },
    clientReferenceId: order.orderNumber,
  };

  const session = await stripeCheckout.createCheckoutSession(request, idempotencyKey);

  if (!session.checkoutUrl) {
    throw new Error("Invalid provider checkout URL.");
  }

  return { checkoutUrl: session.checkoutUrl };
}
