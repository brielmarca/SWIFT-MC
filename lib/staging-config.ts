/** Shared fail-closed checks for the VPS runtime and deployment tooling. */
import { readFileSync } from "node:fs";

export type StagingDatabaseTls = { ca: string; servername: string };

export const STAGING_DB_NAME = "swiftmc_staging";
export const STAGING_DB_CERT_HOSTNAME = "db-staging.swiftmc.com.br";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

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

export function stagingDatabaseConnection(value: string | undefined) {
  let url: URL;
  try {
    url = new URL(value ?? "");
  } catch {
    throw new Error("Only the swiftmc_staging PostgreSQL database (public schema, loopback, verified TLS) is permitted.");
  }
  const allowed = new Set(["schema", "sslmode", "hostaddr"]);
  const loopbackHost = LOOPBACK_HOSTS.has(url.hostname);
  const hostaddr = url.searchParams.get("hostaddr");
  const certHost = url.hostname === STAGING_DB_CERT_HOSTNAME && hostaddr !== null && LOOPBACK_HOSTS.has(hostaddr);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.pathname !== `/${STAGING_DB_NAME}` ||
    !(loopbackHost || certHost) ||
    url.username === "" ||
    url.hash ||
    [...url.searchParams.keys()].some((key) => !allowed.has(key)) ||
    (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") ||
    url.searchParams.get("sslmode") !== "verify-full"
  ) {
    throw new Error("Only the swiftmc_staging PostgreSQL database (public schema, loopback, verified TLS) is permitted.");
  }
  const runtimeUrl = new URL(url.toString());
  runtimeUrl.searchParams.delete("sslmode");
  runtimeUrl.searchParams.delete("hostaddr");
  // Force loopback transport for the driver even when URL hostname is used for certificate verification.
  if (certHost) runtimeUrl.hostname = hostaddr!;
  const migrationUrl = new URL(url.toString());
  migrationUrl.searchParams.set("sslmode", "verify-full");
  if (loopbackHost) migrationUrl.searchParams.set("hostaddr", url.hostname);
  return { runtimeUrl: runtimeUrl.toString(), migrationUrl: migrationUrl.toString(), certHostname: certHost ? STAGING_DB_CERT_HOSTNAME : undefined };
}

export function assertStagingDatabase(value: string | undefined): string {
  return stagingDatabaseConnection(value).runtimeUrl;
}

export function assertStagingEnvironment(env: Record<string, string | undefined>): void {
  if (env.APP_ENV !== "staging" || env.BACKEND_RUNTIME !== "node") {
    throw new Error("Staging Node runtime required.");
  }
  assertStagingDatabase(env.DATABASE_URL);
  if (env.DIRECT_DATABASE_URL) assertStagingDatabase(env.DIRECT_DATABASE_URL);
  const tls = stagingDatabaseTls(env);
  const db = stagingDatabaseConnection(env.DATABASE_URL);
  if (db.certHostname && tls.servername !== db.certHostname) {
    throw new Error("DATABASE_SSL_SERVERNAME must match the database certificate hostname.");
  }
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
