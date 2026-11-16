import assert from "node:assert/strict";
import test from "node:test";
import { assertStagingDatabase, assertStagingEnvironment } from "@/lib/staging-config";
import { proxyStagingRequest } from "../deploy/staging-gateway";
import { validateOrderInput } from "@/lib/orders/order-input";
import { purchasesEnabled } from "@/lib/purchase-gate";
import { getStripeConfig, getStripeWebhookConfig } from "@/lib/server-env";
import { getNodeAuthBindings } from "@/lib/auth-infrastructure/node-bindings";
import { verifyBridgeRequest } from "@/lib/minecraft-bridge/auth";

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const caDir = mkdtempSync(join(tmpdir(), "swiftmc-ca-"));
const caPath = join(caDir, "origin-ca.pem");
writeFileSync(caPath, "-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----\n");
const env = {
  BACKEND_RUNTIME: "node", APP_ENV: "staging", APP_URL: "https://stage.example.test",
  DATABASE_URL: "postgresql://staging:password@db-staging.swiftmc.com.br:5432/swiftmc_staging?schema=public&sslmode=verify-full&hostaddr=127.0.0.1",
  DIRECT_DATABASE_URL: "postgresql://staging:password@db-staging.swiftmc.com.br:5432/swiftmc_staging?schema=public&sslmode=verify-full&hostaddr=127.0.0.1",
  DATABASE_SSL_CA_PATH: caPath, DATABASE_SSL_SERVERNAME: "db-staging.swiftmc.com.br",
  PURCHASES_ENABLED: "false", BACKEND_PROXY_SECRET: "a".repeat(64),
  MINECRAFT_BRIDGE_SERVER_ID: "swift-staging", MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: "swift-staging",
};
test("staging preflight rejects production, alternate DB selectors, live keys and live delivery", () => {
  assert.doesNotThrow(() => assertStagingEnvironment(env));
  // Loopback host form is accepted and SSL URL params are stripped for the driver.
  assert.equal(
    assertStagingDatabase("postgresql://user@127.0.0.1:5432/swiftmc_staging?schema=public&sslmode=verify-full"),
    "postgresql://user@127.0.0.1:5432/swiftmc_staging?schema=public",
  );
  // Certificate-hostname form preserves loopback transport via hostaddr.
  assert.equal(
    assertStagingDatabase(env.DATABASE_URL),
    "postgresql://staging:password@127.0.0.1:5432/swiftmc_staging?schema=public",
  );
  for (const database of ["swiftmc", "swiftmc_test", "postgres", "swiftmc_staging/other"]) {
    assert.throws(() => assertStagingDatabase(`postgresql://user@localhost/${database}?sslmode=verify-full`));
  }
  for (const query of ["host=public.example", "dbname=swiftmc", "schema=other", "options=-csearch_path=other", "sslmode=disable", "sslmode=require", "sslrootcert=/tmp/ca.pem"]) {
    assert.throws(() => assertStagingDatabase(`postgresql://user@127.0.0.1:5432/swiftmc_staging?${query}`));
  }
  assert.throws(() => assertStagingDatabase("postgresql://user@db-staging.swiftmc.com.br:5432/swiftmc_staging?schema=public&sslmode=verify-full"));
  assert.throws(() => assertStagingDatabase("postgresql://user@db-staging.swiftmc.com.br:5432/swiftmc_staging?schema=public&sslmode=verify-full&hostaddr=8.8.8.8"));
  for (const override of [{ APP_ENV: "production" }, { APP_URL: "https://swiftmc.com.br" }, { STRIPE_SECRET_KEY: "sk_live_no" }, { PURCHASES_ENABLED: "true" }, { MINECRAFT_BRIDGE_SERVER_ID: "swift-survival" }, { MINECRAFT_FULFILLMENT_URL: "https://live.example" }, { DATABASE_SSL_CA_PATH: "" }, { DATABASE_SSL_SERVERNAME: "" }, { DATABASE_SSL_SERVERNAME: "wrong.example" }]) {
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

test("staging gateway explicitly restores long cache for official versioned WebP art", async () => {
  const url = env.APP_URL + "/brand/ranks/swift-v2.webp";
  const response = await proxyStagingRequest(new Request(url, {
    headers: { cookie: "session=secret", authorization: "Bearer secret", "x-swift-backend-key": "forged" },
  }), { ...env, BACKEND_ORIGIN: "https://backend.example.test" }, async (_target, init) => {
    const forwarded = new Headers(init!.headers);
    assert.equal(forwarded.get("cookie"), null);
    assert.equal(forwarded.get("authorization"), null);
    assert.equal(forwarded.get("x-swift-backend-key"), env.BACKEND_PROXY_SECRET);
    return new Response("webp-binary-placeholder", {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(response.headers.get("pragma"), null);
  assert.equal(response.headers.get("expires"), null);
});

test("staging gateway restores one-day caching on public unversioned art and HEAD", async () => {
  const response = await proxyStagingRequest(new Request(env.APP_URL + "/brand/enderman.webp", { method: "HEAD" }), {
    ...env, BACKEND_ORIGIN: "https://backend.example.test",
  }, async () => new Response(null, {
    status: 200, headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" },
  }));
  assert.equal(response.headers.get("cache-control"), "public, max-age=86400, stale-while-revalidate=604800");
});

test("staging gateway never caches private or unsafe image-like responses", async () => {
  const cases: { path: string; status: number; headers: Record<string, string>; expected: string }[] = [
    { path: "/brand/ranks/swift-v2.webp?variant=private", status: 200, headers: { "Content-Type": "image/webp" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 404, headers: { "Content-Type": "image/webp" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 200, headers: { "Content-Type": "text/html" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 200, headers: { "Content-Type": "image/webp", "Set-Cookie": "session=secret" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 200, headers: { "Content-Type": "image/webp", Vary: "Cookie, Accept-Encoding" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 200, headers: { "Content-Type": "image/webp", Vary: "*" }, expected: "private, no-store" },
    { path: "/account", status: 200, headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000" }, expected: "private, no-store" },
    { path: "/api/admin/users", status: 200, headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000" }, expected: "private, no-store" },
    { path: "/brand/ranks/swift-v2.webp", status: 200, headers: { "Content-Type": "image/webp" }, expected: "private, no-store" },
  ];
  for (const [index, item] of cases.entries()) {
    const method = index === cases.length - 1 ? "POST" : "GET";
    const response = await proxyStagingRequest(new Request(env.APP_URL + item.path, { method }), {
      ...env, BACKEND_ORIGIN: "https://backend.example.test",
    }, async () => new Response("test", { status: item.status, headers: item.headers }));
    assert.equal(response.headers.get("cache-control"), item.expected, item.path + " [" + index + "]");
  }
});

test("staging gateway preserves existing cache policy for fingerprinted Next static assets", async () => {
  const response = await proxyStagingRequest(new Request(env.APP_URL + "/_next/static/css/abc123.css"), {
    ...env, BACKEND_ORIGIN: "https://backend.example.test",
  }, async () => new Response(".app{}", {
    status: 200, headers: { "Content-Type": "text/css", "Cache-Control": "public, max-age=31536000, immutable" },
  }));
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
});
