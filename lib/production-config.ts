import { readFileSync } from "node:fs";

type Environment = Record<string, string | undefined>;

/** A separate Node deployment; never reinterpret staging URLs as production. */
export function productionDatabaseConfig(env: Environment) {
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    if (env.APP_ENV !== "production" || env.BACKEND_RUNTIME !== "node" ||
        url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
        url.pathname !== "/swiftmc_production" || decodeURIComponent(url.username) !== "swiftmc_production" || !url.password ||
        url.hash || [...url.searchParams.keys()].some(key => !["schema", "sslmode"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
        url.searchParams.get("schema") !== "public" || url.searchParams.get("sslmode") !== "verify-full" ||
        env.DATABASE_SSL_SERVERNAME !== "db.swiftmc.com.br" || !env.DATABASE_SSL_CA_PATH) throw new Error();
    url.search = "";
    return { connectionString: url.toString(), ssl: {
      ca: readFileSync(env.DATABASE_SSL_CA_PATH, "utf8"),
      servername: "db.swiftmc.com.br", rejectUnauthorized: true as const,
    } };
  } catch { throw new Error("Dedicated production database and verified TLS configuration required."); }
}

export function assertProductionEnvironment(env: Environment): void {
  productionDatabaseConfig(env);
  if (env.DIRECT_DATABASE_URL || env.APP_URL !== "https://swiftmc.com.br" || env.STRIPE_TEST_PURCHASES_ENABLED !== "false" ||
      !/^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? "") || !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ||
      env.MERCADOPAGO_ACCESS_TOKEN || env.MINECRAFT_FULFILLMENT_URL ||
      env.MINECRAFT_BRIDGE_SERVER_ID !== "swift-production" || env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS !== "swift-production" ||
      (env.MINECRAFT_BRIDGE_SECRET?.length ?? 0) < 32 || (env.BACKEND_PROXY_SECRET?.length ?? 0) < 32) {
    throw new Error("Isolated production origin, Stripe live credentials and Bridge configuration required.");
  }
}
