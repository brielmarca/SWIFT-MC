import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // UI probes never send payloads to integrations or external hosts.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { status: "unavailable" } });
    return route.continue();
  });
});

test("production security headers and CSP preserve hydration and reject framing", async ({ page, request }) => {
  const violations: string[] = [];
  await page.exposeFunction("recordCspViolation", (directive: string) => violations.push(directive));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (event) => {
    (window as unknown as { recordCspViolation: (directive: string) => void }).recordCspViolation(event.violatedDirective);
  }));
  const response = await page.goto("/rules");
  const headers = response!.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).not.toContain("unsafe-eval");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("payment=()");
  await page.getByRole("tab", { name: "Discord", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Discord", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(violations).toEqual([]);
  const missing = await request.get("/not-a-real-page");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["x-content-type-options"]).toBe("nosniff");
});

test("commerce rejects forged state and foreign origins with no CORS grant", async ({ request }) => {
  for (const path of ["/api/orders", "/api/orders/forged/payment", "/api/webhooks/mercadopago"]) {
    const response = await request.post(`${path}?demo=false`, {
      headers: { Origin: "https://attacker.example", "X-HTTP-Method-Override": "PUT" },
      data: { rankSlug: "swift", price: 0, subtotal: 0, currency: "USD", discount: 100, state: "paid" },
    });
    expect(response.status()).toBe(503);
    expect((await response.json()).error).toBe("DEMO_ONLY");
    expect(response.headers()["cache-control"]).toBe("no-store");
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    const options = await request.fetch(path, { method: "OPTIONS", headers: { Origin: "https://attacker.example", "Access-Control-Request-Method": "POST" } });
    expect(options.headers()["access-control-allow-origin"]).toBeUndefined();
  }
});

test("invalid API inputs fail locally without reflecting payloads or internals", async ({ request }) => {
  for (const path of [
    "/api/minecraft/profile?username=%3Csvg%2Fonload%3D1%3E",
    "/api/player/bad%3Cname/stats",
    "/api/minecraft/avatar/not-a-uuid?view=http://127.0.0.1",
    "/api/leaderboards?category=__proto__&limit=99999",
  ]) {
    const response = await request.get(path, { headers: { Origin: "https://attacker.example" } });
    expect(response.status()).toBe(400);
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
    expect(await response.text()).not.toMatch(/<svg|stack|node_modules|DATABASE_URL|\/home\//);
  }
});

test("image optimizer rejects remote URLs and private files are not served", async ({ request }) => {
  // The target is deliberately loopback; no external host is probed even on a regression.
  const image = await request.get("/_next/image?url=http%3A%2F%2F127.0.0.1%3A1%2Ftest.png&w=640&q=75");
  expect(image.status()).toBe(400);
  for (const path of ["/.env", "/.env.example", "/.git/config", "/package.json", "/.cloudflare/output/v0/workers/default/worker.config.json"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toMatch(/DATABASE_URL|MERCADOPAGO_ACCESS_TOKEN|\[core\]/);
  }
  const redirect = await request.get("/checkout/swift?returnUrl=https://attacker.example", { maxRedirects: 0 });
  expect([307, 308]).toContain(redirect.status());
  expect(redirect.headers().location).toBe("/ranks/swift");
});

test("search, hash and forged cart values remain inert", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("swift-mc-cart", '["swift","__proto__",{"slug":"cosmic","priceCents":0},"javascript:alert(1)"]'));
  const payload = '<img src=x onerror="window.__securityProbe=1">';
  await page.goto(`/rules#${encodeURIComponent(payload)}`);
  await expect(page.getByRole("button", { name: "Abrir carrinho, 1 item", exact: true })).toBeVisible();
  await page.getByRole("searchbox", { name: /Buscar em Servidor/ }).fill(payload);
  await expect(page.locator("img[onerror]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
  } else {
    await page.getByRole("button", { name: "Buscar no site (Ctrl+K)", exact: true }).click();
  }
  await page.getByRole("combobox").fill(payload);
  await expect(page.locator("img[onerror]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __securityProbe?: number }).__securityProbe)).toBeUndefined();
  await page.keyboard.press("Escape");
  await page.goto("/checkout");
  await expect(page.getByRole("link", { name: "Swift", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cosmic", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Concluir demonstração", exact: true })).toBeDisabled();
});
