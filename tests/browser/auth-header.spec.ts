import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.HEADER_UI_FIXTURE !== "1", "Run with node scripts/test-header-browser.mjs");

async function openLogout(page: Page) {
  if ((page.viewportSize()?.width ?? 1440) < 640) {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  }
  const button = page.getByRole("button", { name: "Sair da conta", exact: true });
  await expect(button).toBeEnabled();
  return button;
}

test("guest header offers login, authenticated header links to the existing account", async ({ page }) => {
  await page.goto("/header-test-fixture?guest=1");
  await expect(page.getByRole("link", { name: "Entrar na conta" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Conta: Header Player" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sair da conta" })).toHaveCount(0);
  await page.goto("/header-test-fixture");
  await expect(page.getByRole("link", { name: "Entrar na conta" })).toHaveCount(0);
  const account = page.getByRole("link", { name: "Conta: Header Player" });
  await expect(account).toBeVisible();
  await expect(account).toHaveAttribute("href", "/account");
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  // The real account page remains protected: without a session it redirects.
  await account.click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount/);
});

test("logout posts the current CSRF cookie to /api/logout and navigates home on success", async ({ page, context }) => {
  await page.goto("/login");
  const csrf = (await context.cookies()).find(cookie => cookie.name === "__Host-swiftmc_csrf")!.value;
  await page.goto("/header-test-fixture");
  let calls = 0;
  await page.route("**/api/logout", async (route) => {
    calls++;
    expect(route.request().method()).toBe("POST");
    expect(route.request().headers()["x-csrf-token"]).toBe(csrf);
    expect(route.request().headers().cookie).toContain(`__Host-swiftmc_csrf=${csrf}`);
    await route.fulfill({ json: { ok: true } });
  });
  const button = await openLogout(page);
  await expect(button.locator("..")).toHaveAttribute("action", "/api/logout");
  await button.click();
  await expect(page).toHaveURL("/");
  expect(calls).toBe(1);
});

test("missing CSRF blocks submission with accessible feedback", async ({ page, context }) => {
  await page.goto("/header-test-fixture");
  await context.clearCookies();
  const writes: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") writes.push(request.url()); });
  const button = await openLogout(page);
  await button.click();
  await expect(page.getByRole("banner").getByRole("alert")).toContainText("Não foi possível sair com segurança");
  await expect(page).toHaveURL("/header-test-fixture");
  await expect(button).toBeEnabled();
  expect(writes).toEqual([]);
});

test("CSRF rejection retains the page and allows a safe retry", async ({ page }) => {
  await page.goto("/login");
  await page.goto("/header-test-fixture");
  let calls = 0;
  await page.route("**/api/logout", async (route) => {
    calls++;
    await route.fulfill({ status: 403, json: { error: { code: "CSRF_REJECTED" } } });
  });
  const button = await openLogout(page);
  await button.click();
  await expect(page.getByRole("banner").getByRole("alert")).toContainText("Não foi possível sair.");
  await expect(button).toBeEnabled();
  await expect(page).toHaveURL("/header-test-fixture");
  await button.click();
  await expect.poll(() => calls).toBe(2);
});

test("logout prevents duplicate submissions and recovers from network failure", async ({ page }) => {
  await page.goto("/login");
  await page.goto("/header-test-fixture");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  await page.route("**/api/logout", async (route) => {
    calls++;
    await held;
    await route.abort("failed");
  });
  const button = await openLogout(page);
  await button.click();
  const pending = page.getByRole("button", { name: "Saindo da conta", exact: true });
  try {
    await expect(pending).toBeDisabled();
    await expect.poll(() => calls).toBe(1);
    // Even another form submission while the request is held must be ignored.
    await pending.locator("..").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  } finally {
    release();
  }
  await expect(page.getByRole("banner").getByRole("alert")).toContainText("Não foi possível sair.");
  await expect(button).toBeEnabled();
  await expect(page).toHaveURL("/header-test-fixture");
  expect(calls).toBe(1);
});
