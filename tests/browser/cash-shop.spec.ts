import { expect, test } from "@playwright/test";

test("Cash section shows unavailable purchase state without creating writes", async ({ page }) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") writes.push(request.url());
  });
  await page.goto("/store#cash");
  const shop = page.getByRole("region", { name: "Cash Swift MC" });
  await expect(shop.getByRole("article")).toHaveCount(5);
  const first = shop.getByRole("article", { name: "50 Cash", exact: true });
  await first.getByRole("button", { name: "Informações do pacote de 50 Cash", exact: true }).click();
  await expect(first.getByText("50 Cash.", { exact: true })).toBeVisible();
  await first.getByRole("button", { name: "Compra indisponível — 50 Cash", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "50 Cash", exact: true });
  await expect(dialog).toContainText("Compras e entrega de Cash ficam indisponíveis");
  await dialog.getByRole("button", { name: "Voltar aos pacotes", exact: true }).click();
  expect(writes).toEqual([]);
});

test("Cash cards reflow without horizontal overflow", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/store#cash");
  for (const width of [320, 390, 640, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
