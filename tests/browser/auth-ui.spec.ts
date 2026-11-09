import { expect, test } from "@playwright/test";

const resetToken = "A".repeat(43);
const email = "ui-only@example.test";
const password = "UI-only password 123!";
const routes = [
  { path: "/login", title: "Bem-vindo de volta", action: "Entrar", endpoint: "/api/login", body: { email, password } },
  { path: "/register", title: "Entre para o Swift MC", action: "Criar conta", endpoint: "/api/register", body: { email } },
  { path: "/forgot-password", title: "Recupere sua conta", action: "Enviar instruções", endpoint: "/api/password-reset/request", body: { email } },
  { path: "/reset-password", title: "Defina uma nova senha", action: "Redefinir senha", endpoint: "/api/password-reset/complete", body: { email, newPassword: password, challengeToken: resetToken } },
];

test("login honors safe callbacks and rejects external or encoded redirects", async ({ page }) => {
  await page.route("**/api/login", route => route.fulfill({ json: { ok: true } }));
  for (const [callback, destination] of [
    ["/rules", "/rules"],
    ["https://attacker.example", "/"],
    ["//attacker.example", "/"],
    ["/%2f%2fattacker.example", "/"],
    ["/\\attacker.example", "/"],
  ]) {
    await page.goto(`/login?callbackUrl=${encodeURIComponent(callback)}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(destination);
  }
});

for (const route of routes) {
  test(`${route.path}: isolated responsive UI and API submission`, async ({ page }, testInfo) => {
    await page.route(`**${route.endpoint}`, async (intercept) => {
      await intercept.fulfill({ status: 429, json: { error: { code: "RATE_LIMITED", message: "Tente novamente mais tarde." } } });
    });
    const url = route.path === "/reset-password" ? `${route.path}?token=${resetToken}` : route.path;
    await page.goto(url);
    await expect(page.getByRole("heading", { name: route.title, exact: true })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.locator("header, footer")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /carrinho/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (testInfo.project.name === "desktop") {
      const brand = await page.getByRole("region", { name: "Swift MC", exact: true }).boundingBox();
      expect(brand!.width / 1440).toBeCloseTo(.57, 2);
    }
    for (const control of await page.getByRole("main").locator("input, button, a").all()) {
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const submit = page.getByRole("button", { name: route.action, exact: true });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();
    await page.getByLabel("Email", { exact: true }).fill(email);
    for (const input of await page.locator('input[autocomplete$="password"]').all()) await input.fill(password);
    const requestPromise = page.waitForRequest(request => new URL(request.url()).pathname === route.endpoint && request.method() === "POST");
    await submit.click();
    const submitted = await requestPromise;
    expect(submitted.postDataJSON()).toEqual(route.body);
    const csrf = (await page.context().cookies()).find(cookie => cookie.name === "__Host-swiftmc_csrf");
    expect(csrf).toMatchObject({ secure: true, httpOnly: false, sameSite: "Lax", path: "/" });
    expect(submitted.headers()["x-csrf-token"]).toBe(csrf!.value);
    await expect(page.getByRole("form").getByRole("alert")).toHaveText("Tente novamente mais tarde.");
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await expect(submit).toBeEnabled();
    await expect(page).toHaveURL(url);
    expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
    await page.reload();
    await expect(page.getByRole("form").getByRole("alert")).toHaveCount(0);
    for (const input of await page.locator("input").all()) await expect(input).toHaveValue("");
  });
}

test("keyboard navigation, password visibility, and auth links", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "← Voltar à Swift MC" })).toBeFocused();
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

test("Discord button is disabled without OAuth backend", async ({ page, context }) => {
  await page.goto("/login");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:3100" || request.url().includes("/api/") || request.method() === "POST" || request.isNavigationRequest()) requests.push(request.url());
  });
  await page.getByRole("button", { name: "Continuar com Discord" }).click();
  await expect(page.getByRole("button", { name: "Continuar com Discord" })).toBeDisabled();
  await expect(page).toHaveURL("/login");
  expect(context.pages()).toHaveLength(1);
  expect(requests).toEqual([]);
    expect((await context.cookies()).map(cookie => cookie.name)).toEqual(["__Host-swiftmc_csrf"]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

for (const route of ["/reset-password"]) {
  test(`${route}: password requirements and confirmation validation`, async ({ page }) => {
    await page.goto(route);
    await page.getByLabel("Email", { exact: true }).fill("validation@example.test");
    const password = page.locator('input[name="password"]');
    await password.fill("short");
    await page.locator('input[name="confirmation"]').fill("different");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("Use pelo menos 12 caracteres.", { exact: true })).toBeVisible();
    await expect(page.getByText("As senhas precisam ser iguais.")).toBeVisible();
    await expect(password).toBeFocused();
    await expect(page.getByRole("form").getByRole("alert")).toHaveCount(0);
    await password.fill("Valid password 123!");
    await page.locator('input[name="confirmation"]').fill("");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("As senhas precisam ser iguais.")).toBeVisible();
    await expect(page.locator('input[name="confirmation"]')).toBeFocused();
  });
}

test("without JavaScript forms cannot submit credentials", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:3100${route.path}`);
    await expect(page.getByRole("button", { name: route.action, exact: true })).toBeDisabled();
    for (const input of await page.locator("input").all()) await expect(input).toBeDisabled();
    await expect(page.getByRole("form")).toHaveAttribute("method", "post");
    await expect(page.getByRole("form")).toHaveAttribute("action", route.endpoint);
  }
  await context.close();
});

test("reset rejects missing or malformed link tokens without sending credentials", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", request => { if (request.method() === "POST") posts.push(request.url()); });
  for (const query of ["", "?token=invalid!"]) {
    await page.goto(`/reset-password${query}`);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Nova senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Redefinir senha", exact: true }).click();
    await expect(page.getByRole("form").getByRole("alert")).toHaveText("Link de redefinição inválido. Solicite novas instruções.");
  }
  expect(posts).toEqual([]);
});

test("forgot-password sends only email and displays a generic acknowledgement", async ({ page }) => {
  await page.route("**/api/password-reset/request", route => route.fulfill({ json: { ok: true, acknowledgement: "Se for possível, enviaremos as instruções para o email informado." } }));
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Enviar instruções", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Se for possível, enviaremos as instruções para o email informado.");
  await expect(page).toHaveURL("/forgot-password");
  await expect(page.getByRole("form").getByRole("alert")).toHaveCount(0);
});
