#!/usr/bin/env node
/**
 * Read-only public-endpoint smoke audit. No credentials and no private URLs.
 * Reports approximate response-header TTFB and CDN/cache headers.
 * This does not replace Lighthouse or real-user Core Web Vitals.
 */
import { performance } from "node:perf_hooks";

const input = process.argv[2] || "https://staging.swiftmc.com.br";
let origin;
try {
  origin = new URL(input);
  if (origin.protocol !== "https:" || origin.port || origin.username || origin.password ||
    origin.pathname !== "/" || origin.search || origin.hash ||
    !["staging.swiftmc.com.br", "swiftmc.com.br", "www.swiftmc.com.br"].includes(origin.hostname)) {
    throw new Error("Unexpected target host");
  }
} catch {
  console.error("Usage: node scripts/audit-public-web.mjs https://staging.swiftmc.com.br");
  process.exit(2);
}

const paths = [
  "/", "/store", "/news", "/status", "/robots.txt", "/sitemap.xml",
  "/brand/emblem.webp", "/brand/ranks/swift-v2.webp", "/api/server-status",
];
console.log(`Public HTTP audit — ${origin.origin}`);
console.log("| Path | HTTP | Header TTFB (ms) | Cache-Control | CF-Cache-Status | Content-Type |");
console.log("|---|---:|---:|---|---|---|");
let failed = false;
for (const path of paths) {
  const url = new URL(path, origin);
  try {
    const start = performance.now();
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
      headers: { "Accept": path.endsWith(".webp") ? "image/webp" : "*/*", "User-Agent": "SwiftMC-Public-Audit/1.0" },
    });
    const headerMs = Math.round(performance.now() - start);
    await response.body?.cancel();
    const cache = response.headers.get("cache-control") || "—";
    const cf = response.headers.get("cf-cache-status") || "—";
    const type = response.headers.get("content-type")?.split(";")[0] || "—";
    console.log(`| ${path} | ${response.status} | ${headerMs} | ${cache} | ${cf} | ${type} |`);
    if (!response.ok) failed = true;
  } catch (error) {
    failed = true;
    const reason = error instanceof Error ? error.name : "unknown";
    console.log(`| ${path} | ERROR | — | — | — | ${reason} |`);
  }
}
console.log("\nTTFB above is time to response headers from this runner, not a user field metric.");
console.log("Cloudflare caching may depend on zone rules; CF-Cache-Status is evidence, not a guarantee.");
if (failed) process.exitCode = 1;
