import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCart, getCartRanks, getCartSubtotal } from "@/lib/cart";
import { getRank } from "@/data/ranks";
import { validateOrderInput } from "@/lib/orders/order-input";
import { queryMinecraftProfile } from "@/lib/minecraft-profile-server";
import { fetchMinecraftData } from "@/lib/minecraft-data/client";
import { GET as avatar } from "@/app/api/minecraft/avatar/[uuid]/route";
import { readLimitedResponse } from "@/lib/read-limited-response";
import { demoCommerceBlocked } from "@/lib/demo-commerce";

test("development database publication is restricted to loopback", () => {
  const compose = readFileSync(new URL("../compose.yaml", import.meta.url), "utf8");
  const publishedPorts = compose.match(/- "[^"\n]*:5432"/g);
  assert.deepEqual(publishedPorts, ['- "127.0.0.1:${POSTGRES_PORT:-5433}:5432"']);
});

test("forged commerce bodies are never consumed, regardless of headers or query flags", async () => {
  const request = new Request("http://localhost/api/orders?demo=false&enabled=true", {
    method: "POST", headers: { "X-HTTP-Method-Override": "PUT", Authorization: "Bearer forged" },
    body: '{"price":0,"currency":"USD","discount":100,"checkoutState":"paid","__proto__":{"paid":true}}',
  });
  const response = demoCommerceBlocked(request);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "DEMO_ONLY");
  assert.equal(request.bodyUsed, false);
});

test("cart and order validation use catalog prices and discard forged objects and prototype keys", () => {
  const slugs = parseCart('["swift","__proto__","constructor","swift",{"slug":"cosmic","priceCents":0},"unknown"]');
  assert.deepEqual(slugs, ["swift"]);
  assert.equal(getCartSubtotal(getCartRanks(slugs)), getRank("swift")!.priceCents);
  const result = validateOrderInput(JSON.parse('{"rankSlug":"swift","minecraftUsername":"Steve","email":"test@example.com","priceCents":0,"subtotal":0,"currency":"USD","discount":100,"__proto__":{"paid":true}}'));
  assert.equal(result.data?.rank.priceCents, getRank("swift")!.priceCents);
  assert.equal(Object.hasOwn(result.data!, "currency"), false);
  assert.equal(Object.hasOwn(Object.prototype, "paid"), false);
});

test("SSRF, traversal, header and HTML payloads cannot reach profile upstream", async () => {
  let calls = 0;
  for (const input of ["//127.0.0.1", "https://x.test", "../admin", "a%2fb", "Steve\r\nX:1", "<svg/onload=1>", "x".repeat(17)]) {
    assert.deepEqual(await queryMinecraftProfile(input, async () => { calls++; throw Error("unexpected request"); }), { status: "invalid" });
  }
  assert.equal(calls, 0);
});

test("private API rejects redirect destinations and upstream details without a second request", async () => {
  let calls = 0;
  const result = await fetchMinecraftData({ baseUrl: "https://data.example.test/v1/", token: "test-placeholder" }, ["players", "Steve"], async (url, init) => {
    calls++;
    assert.equal(new URL(String(url)).host, "data.example.test");
    assert.equal(init?.redirect, "manual");
    return new Response("private diagnostic", { status: 302, headers: { Location: "http://127.0.0.1/private" } });
  });
  assert.deepEqual(result, { status: "unavailable" });
  assert.equal(calls, 1);
});

test("avatar validates UUID/view, rejects redirects and non-PNG content with mocked egress", async () => {
  const original = globalThis.fetch;
  const uuid = "01234567-89ab-cdef-0123-456789abcdef";
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(new URL(String(url)).hostname, "crafatar.com");
    assert.equal(init?.redirect, "manual");
    return new Response("<svg onload=alert(1)>", { headers: { "Content-Type": "image/png" } });
  };
  try {
    assert.equal((await avatar(new Request("http://localhost/?view=//evil.test"), { params: Promise.resolve({ uuid }) })).status, 400);
    assert.equal((await avatar(new Request("http://localhost/"), { params: Promise.resolve({ uuid: "../secret" }) })).status, 400);
    assert.equal(calls, 0);
    assert.equal((await avatar(new Request("http://localhost/"), { params: Promise.resolve({ uuid }) })).status, 503);
    globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/" } });
    assert.equal((await avatar(new Request("http://localhost/"), { params: Promise.resolve({ uuid }) })).status, 503);
  } finally { globalThis.fetch = original; }
});

test("streamed upstream bodies are cancelled when they exceed the byte limit", async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(9)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readLimitedResponse(new Response(stream), 8), /size limit/);
  assert.equal(cancelled, true);
});
