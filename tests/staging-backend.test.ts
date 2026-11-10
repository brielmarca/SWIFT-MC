import assert from "node:assert/strict";
import test from "node:test";
import { assertStagingDatabase, assertStagingEnvironment } from "@/lib/staging-config";
import { proxyStagingRequest } from "../deploy/staging-gateway";
import { validateOrderInput } from "@/lib/orders/order-input";
import { purchasesEnabled } from "@/lib/purchase-gate";
import { getStripeConfig, getStripeWebhookConfig } from "@/lib/server-env";
import { getNodeAuthBindings } from "@/lib/auth-infrastructure/node-bindings";
import { verifyBridgeRequest } from "@/lib/minecraft-bridge/auth";

const env = {
  BACKEND_RUNTIME: "node", APP_ENV: "staging", APP_URL: "https://stage.example.test",
  DATABASE_URL: "postgresql://staging:password@127.0.0.1:5432/swiftmc_staging?schema=public",
  PURCHASES_ENABLED: "false", BACKEND_PROXY_SECRET: "a".repeat(64),
  MINECRAFT_BRIDGE_SERVER_ID: "swift-staging", MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: "swift-staging",
};
test("staging preflight rejects production, alternate DB selectors, live keys and live delivery", () => {
  assert.doesNotThrow(() => assertStagingEnvironment(env));
  for (const database of ["swiftmc", "swiftmc_test", "postgres", "swiftmc_staging/other"]) {
    assert.throws(() => assertStagingDatabase(`postgresql://user@localhost/${database}`));
  }
  for (const query of ["host=public.example", "dbname=swiftmc", "schema=other", "options=-csearch_path=other"]) {
    assert.throws(() => assertStagingDatabase(`postgresql://user@localhost/swiftmc_staging?${query}`));
  }
  for (const override of [{ APP_ENV: "production" }, { APP_URL: "https://swiftmc.com.br" }, { STRIPE_SECRET_KEY: "sk_live_no" }, { PURCHASES_ENABLED: "true" }, { MINECRAFT_BRIDGE_SERVER_ID: "swift-survival" }, { MINECRAFT_FULFILLMENT_URL: "https://live.example" }]) {
    assert.throws(() => assertStagingEnvironment({ ...env, ...override }));
  }
});
test("Node purchases require explicit test opt-in, reject live keys in checkout and webhook config", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, env, { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_fake" });
    assert.equal(purchasesEnabled(), false);
    process.env.STRIPE_TEST_PURCHASES_ENABLED = "true";
    assert.equal(purchasesEnabled(), true);
    process.env.STRIPE_SECRET_KEY = "sk_live_fake";
    assert.equal(purchasesEnabled(), false);
    assert.throws(getStripeConfig);
    assert.throws(getStripeWebhookConfig);
  } finally { process.env = previous; }
});
test("Node runtime supplies the existing Bridge authentication capabilities", () => {
  const previous = { ...process.env };
  try {
    Object.assign(process.env, env, { MINECRAFT_BRIDGE_SECRET: "test-bridge-".repeat(5) });
    const bindings = getNodeAuthBindings();
    assert.equal(verifyBridgeRequest(new Headers({ authorization: `Bearer ${process.env.MINECRAFT_BRIDGE_SECRET}`, "x-swift-server": "swift-staging" }), bindings).serverId, "swift-staging");
    assert.throws(() => verifyBridgeRequest(new Headers({ authorization: `Bearer ${process.env.MINECRAFT_BRIDGE_SECRET}`, "x-swift-server": "swift-survival" }), bindings));
  } finally { process.env = previous; }
});
test("Cash price and bonus come from the server catalog, never caller supplied totals", () => {
  const input = validateOrderInput({ rankSlug: "cash-100", minecraftUsername: "Player", email: "p@example.test", priceCents: 1, cashAmount: 999999 });
  assert.equal(input.data?.rank.priceCents, 999);
  assert.equal(input.data?.cashAmount, 110);
});
test("gateway preserves signed bytes and cookies, replaces spoofed headers and does not follow redirects", async () => {
  const raw = '{ "livemode": false, "data": {} }';
  const response = await proxyStagingRequest(new Request(env.APP_URL + "/api/webhooks/stripe?test=1", {
    method: "POST", headers: { "x-swift-backend-key": "forged", "x-forwarded-for": "forged", "stripe-signature": "exact-signature" }, body: raw,
  }), { ...env, BACKEND_ORIGIN: "https://backend.example.test" }, async (url, init) => {
    assert.equal(String(url), "https://backend.example.test/api/webhooks/stripe?test=1");
    assert.equal(new TextDecoder().decode(init!.body as Uint8Array), raw);
    const headers = new Headers(init!.headers);
    assert.equal(headers.get("x-swift-backend-key"), env.BACKEND_PROXY_SECRET);
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(headers.get("stripe-signature"), "exact-signature");
    assert.equal(init!.redirect, "manual");
    const result = new Response(null, { status: 307, headers: { location: "https://backend.example.test/account" } });
    result.headers.append("set-cookie", "session=one; Secure; HttpOnly; Path=/");
    result.headers.append("set-cookie", "csrf=two; Secure; Path=/");
    return result;
  });
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), env.APP_URL + "/account");
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("gateway refuses untrusted origins and oversize webhook bodies before upstream", async () => {
  const upstream = async () => { throw new Error("must not fetch"); };
  const config = { ...env, BACKEND_ORIGIN: "https://backend.example.test" };
  assert.equal((await proxyStagingRequest(new Request("https://swiftmc.com.br/api/session"), config, upstream)).status, 503);
  assert.equal((await proxyStagingRequest(new Request(env.APP_URL + "/api/webhooks/stripe", { method: "POST", body: "x".repeat(1024 * 1024 + 1) }), config, upstream)).status, 413);
});
