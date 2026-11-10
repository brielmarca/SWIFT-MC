import "server-only";

/**
 * Production purchases stay disabled until Stripe checkout and Minecraft
 * fulfillment have passed staging validation and an explicit rollout flag is set.
 */
export function purchasesEnabled(): boolean {
  if (process.env.BACKEND_RUNTIME === "node") {
    return process.env.APP_ENV === "staging" && process.env.STRIPE_TEST_PURCHASES_ENABLED === "true" &&
      process.env.PURCHASES_ENABLED === "false" && /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  }
  return process.env.PURCHASES_ENABLED === "true";
}

export function purchasesDisabledResponse(request?: Request): Response {
  void request;
  return Response.json(
    {
      error: { code: "PURCHASES_DISABLED", message: "Compras indisponíveis até a validação final de pagamento e entrega em homologação." },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
