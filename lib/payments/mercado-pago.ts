import "server-only";

const MERCADO_PAGO_ORDERS_URL = "https://api.mercadopago.com/v1/orders";
const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const MERCADO_PAGO_HOSTS = [
  "mercadopago.com",
  "mercadopago.com.ar",
  "mercadopago.com.br",
  "mercadopago.cl",
  "mercadopago.com.co",
  "mercadopago.com.mx",
  "mercadopago.com.pe",
  "mercadopago.com.uy",
];

export type MercadoPagoOrderRequest = {
  type: "online";
  processing_mode: "manual";
  total_amount: string;
  external_reference?: string;
  payer: { email: string };
  items: Array<{
    title: string;
    quantity: 1;
    unit_price: string;
    unit_measure: "unit";
    total_amount: string;
    external_code: string;
  }>;
  config: {
    online: {
      success_url: string;
      pending_url: string;
      failure_url: string;
      auto_return: "all";
    };
  };
};

export type MercadoPagoOrderResult = {
  providerOrderId: string;
  checkoutUrl: string;
  providerStatus: string | null;
  providerStatusDetail: string | null;
};

export type MercadoPagoOrdersClient = {
  createOrder(request: MercadoPagoOrderRequest, idempotencyKey: string): Promise<MercadoPagoOrderResult>;
};

export type MercadoPagoReconciliationClient = {
  getOrder(providerOrderId: string): Promise<MercadoPagoReconciliationOrder>;
};

export type MercadoPagoReconciliationOrder = {
  id: string;
  externalReference: string;
  totalAmount: string;
  currency: string;
  status: string;
  statusDetail: string;
  paymentId: string | null;
  paymentMethod: string | null;
};

export class MercadoPagoUnavailableError extends Error {
  constructor() {
    super("Mercado Pago order creation is unavailable.");
    this.name = "MercadoPagoUnavailableError";
  }
}

function boundedString(value: unknown, maximum: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maximum ? value : null;
}

function boundedReconciliationOrder(value: unknown): MercadoPagoReconciliationOrder {
  if (!value || typeof value !== "object") throw new MercadoPagoUnavailableError();
  const order = value as Record<string, unknown>;
  const transactions = order.transactions;
  const payments = transactions && typeof transactions === "object"
    ? (transactions as Record<string, unknown>).payments
    : undefined;
  const firstPayment = Array.isArray(payments) && payments.length > 0 && payments[0] && typeof payments[0] === "object"
    ? payments[0] as Record<string, unknown>
    : undefined;
  const paymentMethodValue = firstPayment?.payment_method;
  const paymentMethod = paymentMethodValue && typeof paymentMethodValue === "object"
    ? paymentMethodValue as Record<string, unknown>
    : undefined;
  const id = boundedString(order.id, 255);
  const externalReference = boundedString(order.external_reference, 64);
  const totalAmount = boundedString(order.total_amount, 32);
  const currency = boundedString(order.currency_id, 8);
  const status = boundedString(order.status, 100);
  const statusDetail = boundedString(order.status_detail, 255);

  if (!id || !externalReference || !totalAmount || !currency || !status || !statusDetail) {
    throw new MercadoPagoUnavailableError();
  }

  const paymentId = boundedString(firstPayment?.id, 255);
  const methodId = boundedString(paymentMethod?.id, 100);
  const methodType = boundedString(paymentMethod?.type, 100);

  return {
    id,
    externalReference,
    totalAmount,
    currency,
    status,
    statusDetail,
    paymentId,
    paymentMethod: methodId ?? methodType,
  };
}

async function boundedJsonResponse(response: Response): Promise<unknown> {
  if (!response.ok) throw new MercadoPagoUnavailableError();
  const responseBody = await response.text();
  if (new TextEncoder().encode(responseBody).byteLength > MAX_RESPONSE_BYTES) {
    throw new MercadoPagoUnavailableError();
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    throw new MercadoPagoUnavailableError();
  }
}

export function formatCentsAsDecimal(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Payment amount must be a positive safe integer.");
  }

  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function isValidMercadoPagoCheckoutUrl(value: string): boolean {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return MERCADO_PAGO_HOSTS.some(
    (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

function boundedProviderResult(value: unknown): MercadoPagoOrderResult {
  if (!value || typeof value !== "object") {
    throw new MercadoPagoUnavailableError();
  }

  const response = value as Record<string, unknown>;
  const providerOrderId = response.id;
  const checkoutUrl = response.checkout_url;

  if (
    typeof providerOrderId !== "string" ||
    providerOrderId.length < 1 ||
    providerOrderId.length > 255 ||
    typeof checkoutUrl !== "string" ||
    checkoutUrl.length > 2048 ||
    !isValidMercadoPagoCheckoutUrl(checkoutUrl)
  ) {
    throw new MercadoPagoUnavailableError();
  }

  const status = typeof response.status === "string" ? response.status.slice(0, 100) : null;
  const statusDetail =
    typeof response.status_detail === "string" ? response.status_detail.slice(0, 255) : null;

  return { providerOrderId, checkoutUrl, providerStatus: status, providerStatusDetail: statusDetail };
}

export function createMercadoPagoOrdersClient(
  accessToken: string,
  request: typeof fetch = fetch,
): MercadoPagoOrdersClient & MercadoPagoReconciliationClient {
  return {
    async createOrder(body, idempotencyKey) {
      let response: Response;

      try {
        response = await request(MERCADO_PAGO_ORDERS_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new MercadoPagoUnavailableError();
      }

      try {
        return boundedProviderResult(await boundedJsonResponse(response));
      } catch (error) {
        if (error instanceof MercadoPagoUnavailableError) throw error;
        throw new MercadoPagoUnavailableError();
      }
    },
    async getOrder(providerOrderId) {
      if (!/^[A-Za-z0-9_-]{1,255}$/.test(providerOrderId)) {
        throw new MercadoPagoUnavailableError();
      }

      let response: Response;
      try {
        response = await request(`${MERCADO_PAGO_ORDERS_URL}/${encodeURIComponent(providerOrderId)}`, {
          method: "GET",
          headers: { Accept: "application/json", Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        throw new MercadoPagoUnavailableError();
      }

      return boundedReconciliationOrder(await boundedJsonResponse(response));
    },
  };
}
