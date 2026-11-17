import "server-only";
import { stripeLiveMode } from "./stripe-mode";
import { assertProductionEnvironment } from "./production-config";

/**
 * Production purchases stay disabled until Stripe checkout and Minecraft
 * fulfillment have passed staging validation and an explicit rollout flag is set.
 */
export function purchasesEnabled(): boolean {
  if (process.env.APP_ENV === "production") {
    try {
      assertProductionEnvironment(process.env);
      return stripeLiveMode() && process.env.PURCHASES_ENABLED === "true";
    } catch { return false; }
  }
  if (process.env.BACKEND_RUNTIME === "node") {
    return process.env.APP_ENV === "staging" && process.env.STRIPE_TEST_PURCHASES_ENABLED === "true" &&
      process.env.PURCHASES_ENABLED === "false" && /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  }
  return false;
}

export function purchasesDisabledResponse(request?: Request): Response {
  void request;
  return Response.json(
    {
      error: { code: "PURCHASES_DISABLED", message: "Compras temporariamente indisponíveis. Tente novamente mais tarde." },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
