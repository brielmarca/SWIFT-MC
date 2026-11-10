/** Shared fail-closed checks for the VPS runtime and deployment tooling. */
import { readFileSync } from "node:fs";

export type StagingDatabaseTls = { ca: string; servername: string };

export function stagingDatabaseTls(
  env: Record<string, string | undefined> = process.env,
): StagingDatabaseTls {
  const caPath = env.DATABASE_SSL_CA_PATH?.trim();
  const servername = env.DATABASE_SSL_SERVERNAME?.trim();
  if (!caPath || !servername) {
    throw new Error("DATABASE_SSL_CA_PATH and DATABASE_SSL_SERVERNAME are required for staging PostgreSQL TLS.");
  }
  try {
    return { ca: readFileSync(caPath, "utf8"), servername };
  } catch {
    throw new Error("Unable to read the staging PostgreSQL CA certificate.");
  }
}

export function assertStagingDatabase(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    const allowed = new Set(["schema", "sslmode", "sslrootcert"]);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.pathname !== "/swiftmc_staging" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.username === "" ||
      url.hash ||
      [...url.searchParams.keys()].some((key) => !allowed.has(key)) ||
      (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") ||
      (url.searchParams.has("sslmode") && url.searchParams.get("sslmode") !== "verify-full")
    ) {
      throw new Error();
    }
    return value!;
  } catch {
    throw new Error(
      "Only the swiftmc_staging PostgreSQL database (public schema, loopback, verified TLS) is permitted.",
    );
  }
}

export function assertStagingEnvironment(env: Record<string, string | undefined>): void {
  if (env.APP_ENV !== "staging" || env.BACKEND_RUNTIME !== "node") {
    throw new Error("Staging Node runtime required.");
  }
  assertStagingDatabase(env.DATABASE_URL);
  if (env.DIRECT_DATABASE_URL) assertStagingDatabase(env.DIRECT_DATABASE_URL);
  stagingDatabaseTls(env);
  const origin = new URL(env.APP_URL ?? "");
  if (
    origin.protocol !== "https:" ||
    origin.origin !== env.APP_URL ||
    ["swiftmc.com.br", "www.swiftmc.com.br"].includes(origin.hostname)
  ) {
    throw new Error("A dedicated staging HTTPS origin is required.");
  }
  if (env.PURCHASES_ENABLED !== "false" || env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error("Live/legacy purchases must remain disabled.");
  }
  if (env.MINECRAFT_FULFILLMENT_URL) {
    throw new Error("Use the polling Bridge only; legacy delivery must be disabled.");
  }
  if (
    env.MINECRAFT_BRIDGE_SERVER_ID !== "swift-staging" ||
    env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS !== "swift-staging"
  ) {
    throw new Error("Only the swift-staging Minecraft server is permitted.");
  }
  if (env.STRIPE_SECRET_KEY && !/^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY)) {
    throw new Error("Only Stripe test keys are permitted.");
  }
  if (!env.BACKEND_PROXY_SECRET || env.BACKEND_PROXY_SECRET.length < 32) {
    throw new Error("BACKEND_PROXY_SECRET must contain at least 32 characters.");
  }
}
