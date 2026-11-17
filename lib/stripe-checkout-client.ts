"use client";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";
import { isStripeCheckoutUrl } from "@/lib/payments/stripe-url";

export type StripeCheckoutRequest = {
  type: "vip" | "cash"; rankSlug: string; idempotencyKey: string;
};
export type StripeCheckoutResponse = { checkoutUrl: string; orderNumber: string };
export class StripeCheckoutError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "StripeCheckoutError"; }
}
export async function buyWithStripe(request: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
  const csrf = extractCsrfTokenFromCookie();
  if (!csrf) throw new StripeCheckoutError("CSRF_REQUIRED", "Recarregue a página ou entre novamente para comprar com segurança.");
  const response = await fetch("/api/checkout/stripe", {
    method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(request),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new StripeCheckoutError(body.error?.code ?? "CHECKOUT_UNAVAILABLE", body.error?.message ?? "Pagamento indisponível. Tente novamente.");
  if (!isStripeCheckoutUrl(body.checkoutUrl) || typeof body.orderNumber !== "string") throw new StripeCheckoutError("INVALID_CHECKOUT", "O endereço de pagamento não é válido.");
  return body;
}
export async function redirectToStripeCheckout(request: StripeCheckoutRequest): Promise<void> {
  window.location.assign((await buyWithStripe(request)).checkoutUrl);
}
