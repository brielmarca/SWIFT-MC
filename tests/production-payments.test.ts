import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import { createHmac } from "node:crypto";
import { stripeLiveMode } from "@/lib/stripe-mode";
import { purchasesEnabled } from "@/lib/purchase-gate";
import { assertProductionEnvironment, productionDatabaseConfig } from "@/lib/production-config";
import { POST } from "@/app/api/webhooks/stripe/route";
import { createStripeClient } from "@/lib/payments/stripe";

const directory = mkdtempSync(join(tmpdir(), "swift-production-test-"));
const ca = join(directory, "ca.pem");
writeFileSync(ca, rootCertificates[0]);
after(() => rmSync(directory, { recursive: true, force: true }));
const env = {
  APP_ENV: "production", BACKEND_RUNTIME: "node", APP_URL: "https://swiftmc.com.br",
  DATABASE_URL: "postgresql://swiftmc_production:test@127.0.0.1:5432/swiftmc_production?schema=public&sslmode=verify-full",
  DATABASE_SSL_CA_PATH: ca, DATABASE_SSL_SERVERNAME: "db.swiftmc.com.br",
  PURCHASES_ENABLED: "true", STRIPE_TEST_PURCHASES_ENABLED: "false", STRIPE_SECRET_KEY: "sk_live_fixture_only",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture_only", BACKEND_PROXY_SECRET: "p".repeat(64),
  MINECRAFT_BRIDGE_SECRET: "b".repeat(64), MINECRAFT_BRIDGE_SERVER_ID: "swift-production", MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: "swift-production",
};

test("live purchases require isolated database, identity, credentials and explicit opt-in", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, env);
    assertProductionEnvironment(process.env);
    assert.equal(purchasesEnabled(), true);
    const config = productionDatabaseConfig(env);
    assert.equal(new URL(config.connectionString).search, "");
    assert.equal(config.ssl.rejectUnauthorized, true);
    for (const override of [
      { PURCHASES_ENABLED: "false" }, { APP_ENV: "staging" }, { APP_ENV: "" },
      { STRIPE_SECRET_KEY: "sk_test_fixture" }, { STRIPE_TEST_PURCHASES_ENABLED: "true" },
      { DATABASE_URL: env.DATABASE_URL.replaceAll("swiftmc_production", "swiftmc_staging") },
      { DATABASE_URL: env.DATABASE_URL.replace("127.0.0.1", "public.example") },
      { DATABASE_URL: env.DATABASE_URL + "&sslmode=disable" },
      { MINECRAFT_BRIDGE_SERVER_ID: "swift-staging" }, { APP_URL: "https://stage.example.test" },
    ]) {
      Object.assign(process.env, env, override);
      assert.equal(purchasesEnabled(), false);
    }
    assert.throws(() => stripeLiveMode({ ...env, APP_ENV: "staging" }));
  } finally { process.env = previous; }
});

test("valid signatures cannot cross live/test environment boundaries or omit livemode", async () => {
  const previous = { ...process.env };
  try {
    for (const live of [false, true]) {
      Object.assign(process.env, env, live ? {} : { APP_ENV: "staging", PURCHASES_ENABLED: "false", STRIPE_SECRET_KEY: "sk_test_fixture" });
      for (const livemode of [!live, undefined]) {
        const body = JSON.stringify({ id: "evt_mode", type: "checkout.session.completed", livemode, data: { object: { id: "cs_mode" } } });
        const t = String(Math.floor(Date.now() / 1000));
        const signature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
        const response = await POST(new Request("https://swiftmc.com.br/api/webhooks/stripe", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${signature}` } }));
        assert.equal(response.status, 400);
        assert.equal((await response.json()).error, live ? "LIVE_EVENTS_ONLY" : "TEST_EVENTS_ONLY");
      }
    }
  } finally { process.env = previous; }
});

test("provider re-fetch rejects wrong or missing livemode even with a valid API response", async () => {
  for (const livemode of [false, undefined]) {
    const client = createStripeClient("sk_live_fixture", async () => Response.json({ id: "ch_fixture", status: "succeeded", amount: 999, currency: "brl", refunded: true, livemode }));
    await assert.rejects(client.getCharge("ch_fixture"), { name: "StripeUnavailableError" });
  }
});
