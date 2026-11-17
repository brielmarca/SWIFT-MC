/* global console, fetch, AbortSignal, process */
// Safe read-only smoke test: a handful of requests, no fuzzing or load generation.
// Usage: node scripts/check-public-security.mjs
const base = "https://swiftmc.com.br";
let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    if (!result) throw new Error("unexpected status/header");
    passed++;
    console.log("PASS", label);
  } catch (error) {
    failed++;
    console.error("FAIL", label, error instanceof Error ? error.message : "unknown");
  }
}

async function request(url, method = "GET") {
  return fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(10000) });
}

for (const path of ["/", "/store", "/news"]) {
  await check("Public " + path + " indexable, HSTS, no-store", async () => {
    const response = await request(base + path, "HEAD");
    return response.status === 200 &&
      !/noindex/i.test(response.headers.get("x-robots-tag") ?? "") &&
      /max-age=31536000/.test(response.headers.get("strict-transport-security") ?? "") &&
      /no-store/i.test(response.headers.get("cache-control") ?? "");
  });
}

for (const path of ["/api/user/profile", "/api/admin/provisioned-admins"]) {
  await check("Unauthenticated " + path + " rejected and private", async () => {
    const response = await request(base + path);
    return [401, 403, 429].includes(response.status) &&
      /no-store/i.test(response.headers.get("cache-control") ?? "") &&
      /noindex/i.test(response.headers.get("x-robots-tag") ?? "");
  });
}

await check("Long Minecraft username rejected", async () =>
  (await request(base + "/api/player/" + "a".repeat(52) + "/stats")).status === 400);
await check("Unicode Minecraft username rejected", async () =>
  (await request(base + "/api/player/" + encodeURIComponent("Ｓｔｅｖｅ") + "/stats")).status === 400);
await check("HTTP redirects to canonical HTTPS", async () => {
  const response = await request("http://swiftmc.com.br/store", "HEAD");
  return response.status === 308 && response.headers.get("location") === base + "/store";
});
await check("Origin refuses direct API access without private gateway key", async () =>
  (await request("https://origin.swiftmc.com.br/api/user/profile")).status === 403);
await check("Public robots policy allows pages", async () => {
  const response = await request(base + "/robots.txt");
  const body = await response.text();
  return response.status === 200 && /Allow:\s*\//i.test(body) && !/noindex/i.test(response.headers.get("x-robots-tag") ?? "");
});

console.log("SECURITY SMOKE RESULTS:", passed, "passed,", failed, "failed");
if (failed) process.exitCode = 1;
