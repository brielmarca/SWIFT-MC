import { expect, test } from "@playwright/test";

const routes = [
  { path: "/login", title: "Bem-vindo de volta", action: "Entrar" },
  { path: "/register", title: "Entre para o SwiftMC", action: "Criar conta" },
  { path: "/forgot-password", title: "Recupere sua conta", action: "Enviar instruções" },
  { path: "/reset-password", title: "Defina uma nova senha", action: "Redefinir senha" },
];

for (const route of routes) {
  test(`${route.path}: isolated responsive UI and fail-closed submission`, async ({ page, context }, testInfo) => {
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/") || request.method() === "POST" || request.url().includes("discord.com")) requests.push(request.url());
    });
    await page.goto(route.path);
    await expect(page.getByRole("heading", { name: route.title, exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.locator("header, footer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /carrinho/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (testInfo.project.name === "desktop") {
      const brand = await page.getByRole("region", { name: "SwiftMC", exact: true }).boundingBox();
      expect(brand!.width / 1440).toBeCloseTo(.57, 2);
    }
    for (const control of await page.locator("input, button, a").all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const submit = page.getByRole("button", { name: route.action, exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
    if (route.path !== "/reset-password") await page.getByLabel("Email", { exact: true }).fill("ui-only@example.test");
    for (const input of await page.locator('input[autocomplete$="password"]').all()) await input.fill("UI-only password 123!");
    await submit.click();
    await expect(page.getByRole("form").getByRole("alert")).toHaveText("Autenticação ainda não disponível.");
    await expect(submit).toBeDisabled();
    await expect(page).toHaveURL(route.path);
    for (const input of await page.locator("input").all()) await expect(input).toHaveValue("");
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
    expect(await context.cookies()).toEqual([]);
    expect(requests).toEqual([]);
    await page.reload();
    await expect(page.getByRole("form").getByRole("alert")).toHaveCount(0);
    for (const input of await page.locator("input").all()) await expect(input).toHaveValue("");
  });
}

test("keyboard navigation, password visibility, and auth links", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "← Voltar ao SwiftMC" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Continuar com Discord" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const password = page.getByLabel("Senha", { exact: true });
  await expect(password).toBeFocused();
  await password.fill("Visible only in this field");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Ocultar senha", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/forgot-password");
  await page.getByRole("link", { name: "Voltar para entrar" }).click();
  await page.getByRole("link", { name: "Criar conta", exact: true }).click();
  await expect(page).toHaveURL("/register");
  await page.getByRole("link", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL("/login");
});

test("Discord never starts OAuth or creates browser state", async ({ page, context }) => {
  await page.goto("/login");
  const requests: string[] = [];
  page.on("request", (request) => {
    // Ignore framework asset/link prefetches; capture OAuth, API calls and navigations.
    if (new URL(request.url()).origin !== "http://127.0.0.1:3100" || request.url().includes("/api/") || request.method() === "POST" || request.isNavigationRequest()) requests.push(request.url());
  });
  await page.getByRole("button", { name: "Continuar com Discord" }).click();
  await expect(page.getByRole("form").getByRole("alert")).toHaveText("Autenticação ainda não disponível.");
  await expect(page.getByRole("button", { name: "Continuar com Discord" })).toBeDisabled();
  await expect(page).toHaveURL("/login");
  expect(context.pages()).toHaveLength(1);
  expect(requests).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

for (const route of ["/register", "/reset-password"]) {
  test(`${route}: password requirements and confirmation validation`, async ({ page }) => {
    await page.goto(route);
    if (route === "/register") await page.getByLabel("Email", { exact: true }).fill("validation@example.test");
    const password = page.locator('input[name="password"]');
    await password.fill("short");
    await page.locator('input[name="confirmation"]').fill("different");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Use pelo menos 12 caracteres.", { exact: true })).toBeVisible();
    await expect(page.getByText("As senhas precisam ser iguais.")).toBeVisible();
    await expect(password).toBeFocused();
    await expect(page.getByRole("form").getByRole("alert")).toHaveCount(0);
  });
}

test("without JavaScript forms cannot submit credentials", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3100${route.path}`);
    await expect(page.getByRole("button", { name: route.action, exact: true })).toBeDisabled();
    await expect(page.locator("input").first()).toBeDisabled();
  }
  await context.close();
});
