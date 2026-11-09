import { expect, test } from "@playwright/test";

const token = "A".repeat(43);
test("registration requests email only; the email link collects credentials without persisting them", async ({ page }) => {
  await page.route("**/api/register", r => r.fulfill({ json: { ok: true, acknowledgement: "Confira seu email." } }));
  await page.goto("/register");
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("browser@example.test");
  const registration = page.waitForRequest("**/api/register");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  expect((await registration).postDataJSON()).toEqual({ email: "browser@example.test" });
  await expect(page.getByRole("status")).toHaveText("Confira seu email.");

  const response = await page.goto(`/verify-email?token=${token}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { name: "Verifique seu email" })).toBeVisible();
  await expect(page.locator("header, footer")).toHaveCount(0);
  await expect(page.locator(".cart-toast")).toHaveCount(0);
  const form = page.getByRole("form", { name: "Concluir cadastro" });
  await form.getByLabel("Email", { exact: true }).fill("browser@example.test");
  await form.getByLabel("Nome de exibição").fill("Player");
  await form.getByLabel("Senha", { exact: true }).fill("short");
  await form.getByLabel("Confirmar senha", { exact: true }).fill("different");
  await form.getByRole("button", { name: "Concluir cadastro" }).click();
  await expect(form.getByText("Use pelo menos 12 caracteres.", { exact: true })).toBeVisible();
  await form.getByLabel("Senha", { exact: true }).fill("Browser password 123!");
  await form.getByLabel("Confirmar senha", { exact: true }).fill("Browser password 123!");
  await page.route("**/api/verify-email", r => r.fulfill({ status: 400, json: { error: { message: "Link expirado. Solicite um novo email." } } }));
  const completion = page.waitForRequest("**/api/verify-email");
  await form.getByRole("button", { name: "Concluir cadastro" }).click();
  const sent = await completion;
  expect(sent.postDataJSON()).toEqual({ email: "browser@example.test", displayName: "Player", password: "Browser password 123!", challengeToken: token });
  expect(sent.headers()["x-csrf-token"]).toBeTruthy();
  await expect(form.getByRole("alert")).toHaveText("Link expirado. Solicite um novo email.");
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("existing-account link verifies without password; invalid links offer resend", async ({ page }) => {
  await page.route("**/api/verify-email", r => r.fulfill({ json: { ok: true } }));
  await page.goto(`/verify-email?token=${token}&mode=existing`);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  const form = page.getByRole("form", { name: "Verificar email", exact: true });
  await form.getByLabel("Email", { exact: true }).fill("existing@example.test");
  const sent = page.waitForRequest("**/api/verify-email");
  await form.getByRole("button", { name: "Verificar email", exact: true }).click();
  expect((await sent).postDataJSON()).toEqual({ email: "existing@example.test", challengeToken: token });
  await expect(page).toHaveURL("/login");
  await page.goto("/verify-email?token=invalid");
  await expect(page.getByText("Link ausente ou inválido.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Concluir cadastro" })).toHaveCount(0);
  await page.route("**/api/auth/resend-verification", r => r.fulfill({ json: { ok: true, acknowledgement: "Confira seu email." } }));
  await page.getByLabel("Email", { exact: true }).fill("existing@example.test");
  const resent = page.waitForRequest("**/api/auth/resend-verification");
  await page.getByRole("button", { name: "Reenviar verificação" }).click();
  expect((await resent).postDataJSON()).toEqual({ email: "existing@example.test" });
  await expect(page.getByRole("status")).toHaveText("Confira seu email.");
});
