import assert from "node:assert/strict";
import test from "node:test";
import { cleanGatewayHeaders, applyGatewayResponseSecurity, isPublicIndexablePath } from "../deploy/gateway-security";
import { proxyProductionRequest } from "../deploy/production-gateway";
import { proxyStagingRequest } from "../deploy/staging-gateway";
import { isJavaUsername } from "../lib/minecraft-profile";
import { generateCsrfToken, csrfTokenMatches, digestCsrfToken } from "../lib/auth/csrf";
import { validateCsrfToken } from "../lib/auth/middleware";

const prod = { APP_URL: "https://swiftmc.com.br", BACKEND_ORIGIN: "https://origin.swiftmc.com.br", BACKEND_PROXY_SECRET: "s".repeat(64) };
const staging = { APP_URL: "https://staging.swiftmc.com.br", BACKEND_ORIGIN: "https://staging-origin.swiftmc.com.br", BACKEND_PROXY_SECRET: "s".repeat(64) };

test("gateway discards untrusted hop-by-hop, forwarding and backend-key headers", () => {
  const incoming = new Headers({
    "x-forwarded-for": "127.0.0.1", "x-forwarded-host": "evil.test",
    forwarded: "for=127.0.0.1", "x-real-ip": "127.0.0.1",
    "true-client-ip": "127.0.0.1", "x-swift-backend-key": "attacker",
    "cf-connecting-ip": "spoofed,192.0.2.3", "proxy-authorization": "Basic attacker",
    "x-csrf-token": "valid-app-header", "x-swift-server": "swift-staging",
  });
  const forwarded = cleanGatewayHeaders(incoming, prod.BACKEND_PROXY_SECRET, "swiftmc.com.br");
  for (const key of ["x-forwarded-for", "forwarded", "x-real-ip", "true-client-ip", "proxy-authorization", "cf-connecting-ip"]) {
    assert.equal(forwarded.get(key), null, key + " leaked across gateway");
  }
  assert.equal(forwarded.get("x-forwarded-host"), "swiftmc.com.br");
  assert.equal(forwarded.get("x-forwarded-proto"), "https");
  assert.equal(forwarded.get("x-swift-backend-key"), prod.BACKEND_PROXY_SECRET);
  assert.equal(forwarded.get("x-csrf-token"), "valid-app-header");
  assert.equal(forwarded.get("x-swift-server"), "swift-staging");
});

test("gateway retains a valid Cloudflare source IP and strips proxy IP", () => {
  const headers = cleanGatewayHeaders(new Headers({
    "cf-connecting-ip": "2001:db8::1", "x-forwarded-for": "10.0.0.1",
  }), prod.BACKEND_PROXY_SECRET, "swiftmc.com.br");
  assert.equal(headers.get("cf-connecting-ip"), "2001:db8::1");
  assert.equal(headers.get("x-forwarded-for"), null);
});

test("SEO allowlist is limited to public content, not private routes", () => {
  for (const path of ["/", "/store", "/store/ranks", "/ranks/swift", "/player/Steve", "/online", "/leaderboards", "/news/post", "/wiki/guide", "/robots.txt", "/sitemap.xml"]) {
    assert.equal(isPublicIndexablePath(path), true, path);
  }
  for (const path of ["/api/user/profile", "/account", "/checkout", "/login", "/register", "/reset-password", "/console-r7m4q9v2", "/admin", "/_next/static/chunk.js", "/storeevil"]) {
    assert.equal(isPublicIndexablePath(path), false, path);
  }
});

test("canonical documents lose stale noindex and cannot be CDN cached", () => {
  for (const path of ["/", "/store", "/news", "/robots.txt", "/sitemap.xml"]) {
    const response = new Response("public", { headers: {
      "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public,max-age=999",
      "CDN-Cache-Control": "public,max-age=999", "Cloudflare-CDN-Cache-Control": "public,max-age=999",
    } });
    applyGatewayResponseSecurity(response, path, "GET");
    assert.equal(response.headers.get("x-robots-tag"), null);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("cdn-cache-control"), null);
  }
});

test("private and auth responses are noindex and no-store", () => {
  for (const path of ["/api/user/profile", "/account", "/login", "/checkout", "/console-r7m4q9v2", "/admin"]) {
    const response = new Response("private", { headers: { "Cache-Control": "public, max-age=86400" } });
    applyGatewayResponseSecurity(response, path, "GET");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", path);
    assert.equal(response.headers.get("cache-control"), "private, no-store", path);
  }
});

test("public response carrying Set-Cookie is never forcibly made indexable", () => {
  const response = new Response("public", { headers: {
    "X-Robots-Tag": "noindex,nofollow", "Set-Cookie": "session=test; HttpOnly",
  } });
  applyGatewayResponseSecurity(response, "/news", "GET");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("staging remains noindex while production removes stale public noindex", async () => {
  const upstream = async () => new Response("<html/>", { headers: { "X-Robots-Tag": "noindex, nofollow" } });
  const p = await proxyProductionRequest(new Request(prod.APP_URL + "/news"), prod, upstream);
  const s = await proxyStagingRequest(new Request(staging.APP_URL + "/news"), staging, upstream);
  assert.equal(p.headers.get("x-robots-tag"), null);
  assert.equal(p.headers.get("strict-transport-security"), "max-age=31536000");
  assert.equal(s.headers.get("x-robots-tag"), "noindex, nofollow");
});

test("ambiguous request framing refused before upstream in both environments", async () => {
  let called = false;
  const upstream = async () => { called = true; return new Response("unexpected"); };
  const checks = [
    { url: prod.APP_URL, env: prod, handler: proxyProductionRequest },
    { url: staging.APP_URL, env: staging, handler: proxyStagingRequest },
  ];
  for (const check of checks) {
    const req = new Request(check.url + "/api/webhooks/stripe", {
      method: "POST", body: "test",
      headers: { "content-length": "4", "transfer-encoding": "chunked" },
    });
    const response = await check.handler(req, check.env, upstream);
    assert.equal(response.status, 400);
  }
  assert.equal(called, false);
});

test("CSRF uses exact token match, rejecting malformed length and invalid hash", () => {
  const token = generateCsrfToken();
  const request = (cookie: string, header: string) => new Request("https://swiftmc.com.br/api/login", {
    method: "POST",
    headers: { cookie: "__Host-swiftmc_csrf=" + cookie, "x-csrf-token": header },
  });
  assert.equal(validateCsrfToken(request(token, token)), true);
  assert.equal(validateCsrfToken(request(token, token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A"))), false);
  assert.equal(validateCsrfToken(request(token, "short")), false);
  assert.equal(validateCsrfToken(request("a".repeat(500), "a".repeat(500))), false);
  assert.equal(csrfTokenMatches(token, digestCsrfToken(token)), true);
  assert.equal(csrfTokenMatches(token, "zz".repeat(32)), false);
});

test("Java usernames reject long, Unicode, path, and confusable usernames", () => {
  assert.equal(isJavaUsername("Steve_123"), true);
  for (const input of ["a".repeat(52), "ab", "Steve.com", "Stéve", "Ｓｔｅｖｅ", "Steve\u200d", "../admin", "\ud800"]) {
    assert.equal(isJavaUsername(input), false, JSON.stringify(input));
  }
});
