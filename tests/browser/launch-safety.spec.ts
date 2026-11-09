import { expect, test } from "@playwright/test";

for (const path of ["/", "/store", "/ranks/swift", "/ranks/eclipse", "/ranks/cosmic", "/ranks/overdrive", "/privacy", "/terms", "/refund", "/leaderboards", "/events", "/player"]) {
  test(`launch route and mobile overflow: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/server-status", route => route.fulfill({ json: { online: false, players: null, maxPlayers: null, version: null, publicAddress: "localhost" } }));
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (["/privacy", "/terms", "/refund"].includes(path)) {
      await expect(page.getByRole("main")).toContainText(/pendente|preliminar|não foi aprovado/);
    }
    expect(errors).toEqual([]);
  });
}

test("disabled checkout rejects direct payment attempts", async ({ request }) => {
  const response = await request.post("/api/checkout/stripe", { data: { type: "vip", rankSlug: "swift", idempotencyKey: "11111111-1111-4111-8111-111111111111" } });
  expect(response.status()).toBe(503);
  expect((await response.json()).error.code).toBe("PURCHASES_DISABLED");
  expect(response.headers()["cache-control"]).toContain("no-store");
  for (const path of ["/api/orders", "/api/orders/forged/payment"]) {
    const alternative = await request.post(path, { data: { provider: "MERCADO_PAGO" } });
    expect([401, 429, 503]).toContain(alternative.status());
  }
});
