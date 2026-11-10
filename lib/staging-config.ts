/** Shared fail-closed checks for the VPS runtime and deployment tooling. */
export function assertStagingDatabase(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname !== "/swiftmc_staging" ||
        !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
        url.hash || [...url.searchParams.keys()].some(key => key !== "schema") ||
        (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public")) throw new Error();
    return value!;
  } catch { throw new Error("Only the swiftmc_staging PostgreSQL database (public schema) is permitted."); }
}

export function assertStagingEnvironment(env: Record<string, string | undefined>): void {
  if (env.APP_ENV !== "staging" || env.BACKEND_RUNTIME !== "node") throw new Error("Staging Node runtime required.");
  assertStagingDatabase(env.DATABASE_URL);
  if (env.DIRECT_DATABASE_URL) assertStagingDatabase(env.DIRECT_DATABASE_URL);
  const origin = new URL(env.APP_URL ?? "");
  if (origin.protocol !== "https:" || origin.origin !== env.APP_URL ||
      ["swiftmc.com.br", "www.swiftmc.com.br"].includes(origin.hostname)) throw new Error("A dedicated staging HTTPS origin is required.");
  if (env.PURCHASES_ENABLED !== "false" || env.MERCADOPAGO_ACCESS_TOKEN) throw new Error("Live/legacy purchases must remain disabled.");
  if (env.MINECRAFT_FULFILLMENT_URL) throw new Error("Use the polling Bridge only; legacy delivery must be disabled.");
  if (env.MINECRAFT_BRIDGE_SERVER_ID !== "swift-staging" || env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS !== "swift-staging") throw new Error("Only the swift-staging Minecraft server is permitted.");
  if (env.STRIPE_SECRET_KEY && !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)) throw new Error("Only Stripe test keys are permitted.");
  if (!env.BACKEND_PROXY_SECRET || env.BACKEND_PROXY_SECRET.length < 32) throw new Error("BACKEND_PROXY_SECRET must contain at least 32 characters.");
}
