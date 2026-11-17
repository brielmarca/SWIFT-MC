import { expect, test } from "@playwright/test";

test("first-visit cookies require explicit opt-in and keep rejection across navigation", async ({ page }) => {
  await page.goto("/login");
  const dialog = page.getByRole("dialog", { name: "Preferências de privacidade e cookies" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: /Estatísticas/ })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /Publicidade/ })).not.toBeChecked();
  await expect(page.evaluate(() => localStorage.getItem("swiftmc-cookie-preferences-v1"))).resolves.toBeNull();
  await dialog.getByRole("button", { name: "Rejeitar opcionais" }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("swiftmc-cookie-preferences-v1")!));
  expect(stored).toMatchObject({ necessary: true, analytics: false, marketing: false });
  await page.reload();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Cookies", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("checkbox", { name: /Estatísticas/ })).not.toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: /Publicidade/ })).not.toBeChecked();
});
