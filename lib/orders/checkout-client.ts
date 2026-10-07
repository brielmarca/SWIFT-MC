export type CheckoutFields = {
  minecraftUsername: string;
  email: string;
};

export type CheckoutFieldErrors = {
  minecraftUsername?: string;
  email?: string;
};

export type CreatedOrder = {
  orderNumber: string;
  paymentToken: string;
  status: "PENDING_PAYMENT";
  rank: {
    slug: string;
    name: string;
    duration: string;
  };
  totalCents: number;
  currency: string;
  expiresAt: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const minecraftUsernamePattern = /^[\p{L}\p{N}_ .#-]+$/u;

export function validateCheckoutFields(fields: CheckoutFields): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {};
  const username = fields.minecraftUsername.trim();
  const email = fields.email.trim();

  if (!username) {
    errors.minecraftUsername = "Informe seu nome de usuário no Minecraft.";
  } else if (username.length < 3 || username.length > 32 || !minecraftUsernamePattern.test(username)) {
    errors.minecraftUsername = "Digite um usuário válido, sem comandos ou caracteres de controle.";
  }

  if (!email) {
    errors.email = "Informe seu e-mail.";
  } else if (email.length > 254 || !emailPattern.test(email)) {
    errors.email = "Digite um e-mail válido, como nome@exemplo.com.";
  }

  return errors;
}

function isCreatedOrder(value: unknown): value is CreatedOrder {
  if (!value || typeof value !== "object") return false;

  const order = value as Partial<CreatedOrder>;
  return (
    typeof order.orderNumber === "string" &&
    typeof order.paymentToken === "string" &&
    order.paymentToken.length >= 32 &&
    order.status === "PENDING_PAYMENT" &&
    typeof order.totalCents === "number" &&
    Number.isInteger(order.totalCents) &&
    typeof order.currency === "string" &&
    typeof order.expiresAt === "string" &&
    Boolean(order.rank) &&
    typeof order.rank?.slug === "string" &&
    typeof order.rank?.name === "string" &&
    typeof order.rank?.duration === "string"
  );
}

function isPaymentCheckout(value: unknown): value is { checkoutUrl: string } {
  if (!value || typeof value !== "object") return false;

  const checkout = value as { checkoutUrl?: unknown };
  if (typeof checkout.checkoutUrl !== "string") return false;

  try {
    return new URL(checkout.checkoutUrl).protocol === "https:";
  } catch {
    return false;
  }
}

export async function startPayment(
  order: Pick<CreatedOrder, "orderNumber" | "paymentToken">,
  request: typeof fetch = fetch,
): Promise<string> {
  const response = await request(`/api/orders/${encodeURIComponent(order.orderNumber)}/payment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${order.paymentToken}` },
  });

  if (!response.ok) {
    if (response.status === 409 || response.status === 410) {
      throw new Error("ORDER_NOT_PAYABLE");
    }

    throw new Error("PAYMENT_UNAVAILABLE");
  }

  const checkout: unknown = await response.json();
  if (!isPaymentCheckout(checkout)) throw new Error("INVALID_RESPONSE");

  return checkout.checkoutUrl;
}

export async function submitOrder(
  rankSlug: string,
  fields: CheckoutFields,
  idempotencyKey: string,
  request: typeof fetch = fetch,
): Promise<CreatedOrder> {
  const response = await request("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      rankSlug,
      minecraftUsername: fields.minecraftUsername,
      email: fields.email,
    }),
  });

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("INVALID_ORDER");
    }

    if (response.status === 409) {
      throw new Error("IDEMPOTENCY_CONFLICT");
    }

    throw new Error("ORDER_UNAVAILABLE");
  }

  const order: unknown = await response.json();

  if (!isCreatedOrder(order)) {
    throw new Error("INVALID_RESPONSE");
  }

  return order;
}
