import assert from "node:assert/strict";
import test from "node:test";
import { proxyProductionRequest } from "../deploy/production-gateway";

const env = {
  APP_URL: "https://swiftmc.com.br",
  BACKEND_ORIGIN: "https://origin.swiftmc.com.br",
  BACKEND_PROXY_SECRET: "p".repeat(64),
};

test("production gateway injects private key and preserves raw Stripe webhook body", async () => {
  const raw = '{"id":"evt_test","type":"checkout.session.completed","livemode":true}';
  const response = await proxyProductionRequest(new Request("https://swiftmc.com.br/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=abc", "x-forwarded-for": "spoofed", "x-swift-backend-key": "spoofed" },
    body: raw,
  }), env, async (url, init) => {
    assert.equal(String(url), "https://origin.swiftmc.com.br/api/webhooks/stripe");
    assert.equal(new TextDecoder().decode(init!.body as Uint8Array), raw);
    const headers = new Headers(init!.headers);
    assert.equal(headers.get("x-swift-backend-key"), env.BACKEND_PROXY_SECRET);
    assert.equal(headers.get("stripe-signature"), "t=1,v1=abc");
    assert.equal(headers.get("x-forwarded-for"), null);
    assert.equal(headers.get("x-forwarded-host"), "swiftmc.com.br");
    assert.equal(headers.get("x-forwarded-proto"), "https");
    assert.equal(init!.redirect, "manual");
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), null);
});

test("production gateway rewrites backend redirects and rejects untrusted/staging origins", async () => {
  const redirect = await proxyProductionRequest(new Request("https://swiftmc.com.br/checkout"), env, async () =>
    new Response(null, { status: 302, headers: { location: "https://origin.swiftmc.com.br/account/orders" } }));
  assert.equal(redirect.headers.get("location"), "https://swiftmc.com.br/account/orders");
  const upstream = async () => { throw new Error("must not fetch"); };
  assert.equal((await proxyProductionRequest(new Request("https://swiftmc.com.br/api/session"), { ...env, APP_URL: "https://staging.swiftmc.com.br" }, upstream)).status, 503);
  assert.equal((await proxyProductionRequest(new Request("https://staging.swiftmc.com.br/api/session"), env, upstream)).status, 503);
  assert.equal((await proxyProductionRequest(new Request("https://swiftmc.com.br/api/webhooks/stripe", { method: "POST", body: "x".repeat(1024 * 1024 + 1) }), env, upstream)).status, 413);
});
