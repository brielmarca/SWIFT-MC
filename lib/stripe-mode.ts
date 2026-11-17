/** Explicit environment selection; NODE_ENV=production also applies to staging builds. */
export function stripeLiveMode(env: Record<string, string | undefined> = process.env): boolean {
  if (env.APP_ENV === "production" && env.BACKEND_RUNTIME === "node" &&
      env.APP_URL === "https://swiftmc.com.br" && env.STRIPE_TEST_PURCHASES_ENABLED === "false" &&
      /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "")) return true;
  if (env.APP_ENV === "staging" && env.PURCHASES_ENABLED === "false" &&
      /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? "")) return false;
  throw new Error("Stripe environment and credential mode mismatch.");
}
