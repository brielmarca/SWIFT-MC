import "server-only";

/**
 * Production purchases stay disabled until Stripe checkout and Minecraft
 * fulfillment have passed staging validation and an explicit rollout flag is set.
 */
export function purchasesEnabled(): boolean {
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
