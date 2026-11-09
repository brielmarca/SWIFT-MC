import "server-only";

const STRIPE_API_URL = "https://api.stripe.com";
const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

const STRIPE_ID_PATTERN = /^[A-Za-z0-9_]{1,255}$/;

export type StripeCheckoutSession = {
  id: string;
  object: "checkout.session";
  mode: "payment" | "subscription";
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  customer: string | null;
  subscription: string | null;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string>;
  payment_intent: string | null;
};

export type StripeInvoice = {
  id: string;
  status: string;
  subscription: string | null;
  customer: string | null;
  amount_paid: number;
  amount_due: number;
  currency: string;
  metadata: Record<string, string>;
};

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string;
  metadata: Record<string, string>;
  cancel_at_period_end: boolean;
  ended_at: number | null;
};

export type StripeCharge = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  refunded: boolean;
  receipt_email: string | null;
  metadata: Record<string, string>;
  payment_intent: string | null;
};

export type StripeReconciliationClient = {
  getCheckoutSession(sessionId: string): Promise<StripeCheckoutSession | null>;
  getInvoice(invoiceId: string): Promise<StripeInvoice | null>;
  getSubscription(subscriptionId: string): Promise<StripeSubscription | null>;
  getCharge(chargeId: string): Promise<StripeCharge | null>;
};

export class StripeUnavailableError extends Error {
  constructor() {
    super("Stripe API is unavailable.");
    this.name = "StripeUnavailableError";
  }
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

function boundedObject(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
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

function boundedMetadata(value: unknown): Record<string, string> {
  return boundedObject(value) ?? {};
}

function boundedCheckoutSession(value: unknown): StripeCheckoutSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Record<string, unknown>;
  const id = boundedString(session.id, 255);
  const object = session.object;
  const mode = session.mode;
  const status = session.status;
  const paymentStatus = session.payment_status;
  const customer = typeof session.customer === "string" ? session.customer : null;
  const subscription = typeof session.subscription === "string" ? session.subscription : null;
  const amountTotal =
    typeof session.amount_total === "number" ? session.amount_total : null;
  const currency = boundedString(session.currency, 8);
  const clientReferenceId =
    typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null;

  if (
    !id ||
    object !== "checkout.session" ||
    (mode !== "payment" && mode !== "subscription") ||
    (status !== "open" && status !== "complete" && status !== "expired") ||
    (paymentStatus !== "paid" &&
      paymentStatus !== "unpaid" &&
      paymentStatus !== "no_payment_required") ||
    !currency
  ) {
    return null;
  }

  return {
    id,
    object: "checkout.session",
    mode,
    status,
    payment_status: paymentStatus,
    customer,
    subscription,
    amount_total: amountTotal,
    currency,
    client_reference_id: clientReferenceId,
    metadata: boundedMetadata(session.metadata),
    payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
  };
}

function boundedInvoice(value: unknown): StripeInvoice | null {
  if (!value || typeof value !== "object") return null;
  const invoice = value as Record<string, unknown>;
  const id = boundedString(invoice.id, 255);
  const status = boundedString(invoice.status, 100);
  const subscription =
    typeof invoice.subscription === "string" ? invoice.subscription : null;
  const customer = typeof invoice.customer === "string" ? invoice.customer : null;
  const amountPaid =
    typeof invoice.amount_paid === "number" ? invoice.amount_paid : null;
  const amountDue = typeof invoice.amount_due === "number" ? invoice.amount_due : null;
  const currency = boundedString(invoice.currency, 8);

  if (!id || !status || amountPaid === null || amountDue === null || !currency) return null;

  return {
    id,
    status,
    subscription,
    customer,
    amount_paid: amountPaid,
    amount_due: amountDue,
    currency,
    metadata: boundedMetadata(invoice.metadata),
  };
}

function boundedSubscription(value: unknown): StripeSubscription | null {
  if (!value || typeof value !== "object") return null;
  const subscription = value as Record<string, unknown>;
  const id = boundedString(subscription.id, 255);
  const status = boundedString(subscription.status, 100);
  const customer = typeof subscription.customer === "string" ? subscription.customer : null;
  const cancelAtPeriodEnd = typeof subscription.cancel_at_period_end === "boolean" ? subscription.cancel_at_period_end : false;
  const endedAt =
    typeof subscription.ended_at === "number" ? subscription.ended_at : null;

  if (!id || !status || !customer) return null;

  return {
    id,
    status,
    customer,
    metadata: boundedMetadata(subscription.metadata),
    cancel_at_period_end: cancelAtPeriodEnd,
    ended_at: endedAt,
  };
}

function boundedCharge(value: unknown): StripeCharge | null {
  if (!value || typeof value !== "object") return null;
  const charge = value as Record<string, unknown>;
  const id = boundedString(charge.id, 255);
  const status = boundedString(charge.status, 100);
  const amount = typeof charge.amount === "number" ? charge.amount : null;
  const currency = boundedString(charge.currency, 8);
  const refunded = typeof charge.refunded === "boolean" ? charge.refunded : false;
  const receiptEmail =
    typeof charge.receipt_email === "string" ? charge.receipt_email : null;

  if (!id || !status || amount === null || !currency) return null;

  return {
    id,
    status,
    amount,
    currency,
    refunded,
    receipt_email: receiptEmail,
    metadata: boundedMetadata(charge.metadata),
    payment_intent: typeof charge.payment_intent === "string" ? charge.payment_intent : null,
  };
}

function isValidStripeId(value: string): boolean {
  return STRIPE_ID_PATTERN.test(value);
}

export function createStripeClient(
  secretKey: string,
  request: typeof fetch = fetch,
): StripeReconciliationClient {
  async function get(path: string): Promise<unknown> {
    if (!/^\/v1\//.test(path)) throw new StripeUnavailableError();
    let response: Response;
    try {
      response = await request(`${STRIPE_API_URL}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${secretKey}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "manual",
      });
    } catch {
      throw new StripeUnavailableError();
    }
    return boundedJsonResponse(response);
  }

  return {
    async getCheckoutSession(sessionId) {
      if (!isValidStripeId(sessionId)) throw new StripeUnavailableError();
      return boundedCheckoutSession(await get(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`));
    },
    async getInvoice(invoiceId) {
      if (!isValidStripeId(invoiceId)) throw new StripeUnavailableError();
      return boundedInvoice(await get(`/v1/invoices/${encodeURIComponent(invoiceId)}`));
    },
    async getSubscription(subscriptionId) {
      if (!isValidStripeId(subscriptionId)) throw new StripeUnavailableError();
      return boundedSubscription(await get(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`));
    },
    async getCharge(chargeId) {
      if (!isValidStripeId(chargeId)) throw new StripeUnavailableError();
      return boundedCharge(await get(`/v1/charges/${encodeURIComponent(chargeId)}`));
    },
  };
}
