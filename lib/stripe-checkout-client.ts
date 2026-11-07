"use client";

export type StripeCheckoutRequest = {
  type: "vip" | "coins";
  rankSlug?: string;
  coinsPackageId?: number;
  minecraftUsername: string;
  email: string;
  idempotencyKey: string;
};

export type StripeCheckoutResponse = {
  checkoutUrl: string;
  orderNumber: string;
};

export class StripeCheckoutError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "StripeCheckoutError";
  }
}

export async function buyWithStripe(
  request: StripeCheckoutRequest,
): Promise<StripeCheckoutResponse> {
  const response = await fetch("/api/checkout/stripe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (response.status === 503) {
    const body = (await response.json()) as { error?: string };
    throw new StripeCheckoutError(
      body.error ?? "DEMO_ONLY",
      "Checkout em demonstração está ativo. Nenhuma cobrança real será realizada.",
    );
  }

  if (!response.ok) {
    const body = (await response.json()) as { error?: string };
    throw new StripeCheckoutError(
      body.error ?? "UNKNOWN_ERROR",
      `Erro ao criar checkout: ${response.status}`,
    );
  }

  const data = (await response.json()) as StripeCheckoutResponse;
  return data;
}

export async function redirectToStripeCheckout(
  request: StripeCheckoutRequest,
): Promise<void> {
  const result = await buyWithStripe(request);
  window.location.href = result.checkoutUrl;
}
