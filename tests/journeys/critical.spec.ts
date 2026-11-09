import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createTestPrisma } from "../integration/helpers";

const db = createTestPrisma()!;
test.afterAll(async () => { await db.$disconnect(); });
const password = "Journey initial password 123!";
async function emailLink(email: string) {
  let link = "";
  await expect.poll(() => {
    const messages = readFileSync(process.env.JOURNEY_MAIL!, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line));
    const mail = messages.filter(mail => mail.to.includes(email)).at(-1);
    link = mail?.html.match(/href="([^"]+)"/)?.[1] ?? "";
    return link;
  }).not.toBe("");
  return link;
}
async function complete(page: Page, email: string) {
  const form = page.getByRole("form", { name: "Concluir cadastro" });
  await form.getByLabel("Email", { exact: true }).fill(email);
  await form.getByLabel("Nome de exibição").fill("Journey Player");
  await form.getByLabel("Senha", { exact: true }).fill(password);
  await form.getByLabel("Confirmar senha", { exact: true }).fill(password);
  await form.getByRole("button", { name: "Concluir cadastro" }).click();
}
async function login(page: Page, email: string, secret: string) {
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("real registration, resend, session, profile, password recovery, checkout and orders", async ({ page, context }, info) => {
  test.setTimeout(180000);
  const email = `${randomUUID()}@journey.invalid`;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // Only local browser requests; Minecraft and provider calls are not part of this journey.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname === "/api/server-status") return route.fulfill({ json: { online: false, players: null, maxPlayers: null, version: null, publicAddress: "play.journey.invalid" } });
    if (url.pathname.startsWith("/api/minecraft/")) return route.fulfill({ status: 503, json: { status: "unavailable" } });
    return route.continue();
  });
  // Emulate distinct edge client addresses for the two sequential projects.
  await context.setExtraHTTPHeaders({ "cf-connecting-ip": info.project.name === "desktop" ? "192.0.2.10" : "192.0.2.11" });

  await test.step("unauthorized pages and registration", async () => {
    for (const path of ["/account", "/account/orders", "/account/profile", "/checkout"]) {
      await page.goto(path);
      await expect(page).toHaveURL(`/login?callbackUrl=${encodeURIComponent(path)}`);
    }
    await page.goto("/register");
    await page.getByLabel("Email", { exact: true }).fill(email);
    const sent = page.waitForResponse("**/api/register");
    await page.getByRole("button", { name: "Criar conta", exact: true }).click();
    expect((await sent).status()).toBe(200);
    expect(await db.user.count({ where: { emailNormalized: email } })).toBe(0);
    const expired = await emailLink(email);
    await db.emailChallenge.updateMany({ where: { emailNormalized: email }, data: { createdAt: new Date(Date.now() - 1200000), expiresAt: new Date(Date.now() - 600000) } });
    await page.goto(expired);
    const rejected = page.waitForResponse("**/api/verify-email");
    await complete(page, email);
    expect((await rejected).status()).toBe(400);
    await expect(page.getByRole("form", { name: "Concluir cadastro" }).getByRole("alert")).toBeVisible();
    await page.goto("/verify-email?token=invalid");
    await expect(page.getByText("Link ausente ou inválido.", { exact: false })).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(email);
    const resent = page.waitForResponse("**/api/auth/resend-verification");
    await page.getByRole("button", { name: "Reenviar verificação" }).click();
    expect((await resent).status()).toBe(200);
    const fresh = await emailLink(email);
    expect(fresh).not.toBe(expired);
    await page.goto(fresh);
    await complete(page, email);
    await expect(page).toHaveURL("/");
    expect((await db.user.findUniqueOrThrow({ where: { emailNormalized: email } })).emailVerifiedAt).not.toBeNull();
  });

  await test.step("session persists across navigation and reload", async () => {
    const session = (await context.cookies()).find(cookie => cookie.name === "__Host-swiftmc_session");
    expect(session).toMatchObject({ secure: true, httpOnly: true, sameSite: "Lax", path: "/" });
    await page.goto("/account");
    await expect(page.getByRole("heading", { name: "Minha conta", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Verificado", { exact: true })).toBeVisible();
  });

  await test.step("profile submits authenticated mutation", async () => {
    await page.getByRole("link", { name: "Editar perfil", exact: true }).click();
    await page.getByLabel("Nome de exibição").fill("Updated Journey");
    const response = page.waitForResponse("**/api/user/profile");
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    expect((await response).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel("Nome de exibição")).toHaveValue("Updated Journey");
  });

  await test.step("logout revokes session; login returns to protected destination", async () => {
    await page.goto("/account");
    await page.getByRole("main").getByRole("button", { name: "Sair da conta", exact: true }).click();
    await expect(page).toHaveURL("/");
    expect((await context.cookies()).some(cookie => cookie.name === "__Host-swiftmc_session")).toBe(false);
    await page.goto("/account/orders");
    await login(page, email, password);
    await expect(page).toHaveURL("/account/orders");
    await expect(page.getByText("Nenhum pedido ainda", { exact: true })).toBeVisible();
  });

  await test.step("authenticated checkout rejects purchases while disabled", async () => {
    await page.goto("/ranks/swift");
    await page.getByRole("button", { name: /Adicionar.*carrinho/i }).first().click();
    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Revisar seleção", exact: true })).toBeVisible();
    await expect(page.getByText("Compras indisponíveis no momento.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pagar com Stripe", exact: true })).toHaveCount(0);
    const checkout = await page.request.post("/api/checkout/stripe", { data: { type: "vip", rankSlug: "swift", idempotencyKey: randomUUID() } });
    expect(checkout.status()).toBe(503);
    expect((await checkout.json()).error.code).toBe("PURCHASES_DISABLED");
    await expect(page).toHaveURL("/checkout");
    const user = await db.user.findUniqueOrThrow({ where: { emailNormalized: email } });
    expect(await db.order.count({ where: { userId: user.id } })).toBe(0);
    for (const status of ["PAID", "FULFILLED", "REFUNDED"] as const) {
      await db.order.create({ data: { userId: user.id, publicToken: randomUUID(), orderNumber: `JOURNEY-${status}-${info.project.name}`, status, rankSlug: "swift", rankName: "Swift", rankDuration: "Mensal", minecraftUsername: "JourneyPlayer", email, currency: "BRL", subtotalCents: 1990, totalCents: 1990, checkoutIdempotencyKey: randomUUID(), expiresAt: new Date(Date.now() + 60000) } });
    }
    await page.goto("/account/orders");
    for (const label of ["Pago", "Entregue", "Reembolsado"]) await expect(page.getByRole("cell", { name: label, exact: true })).toBeVisible();
  });

  await test.step("password reset email and browser form invalidate old session", async () => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email", { exact: true }).fill(email);
    const sent = page.waitForResponse("**/api/password-reset/request");
    await page.getByRole("button", { name: "Enviar instruções" }).click();
    expect((await sent).status()).toBe(200);
    await page.goto(await emailLink(email));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Nova senha", { exact: true }).fill("Reset journey password 123!");
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill("Reset journey password 123!");
    await page.getByRole("button", { name: "Redefinir senha", exact: true }).click();
    await expect(page).toHaveURL("/login");
    await page.goto("/account");
    await expect(page).toHaveURL("/login?callbackUrl=%2Faccount");
    await login(page, email, "Reset journey password 123!");
    await expect(page).toHaveURL("/account");
  });

  await test.step("authenticated password API preserves CSRF and revokes the session", async () => {
    // No password-change form exists yet. Exercise the real API in the browser,
    // explicitly distinct from UI coverage.
    const statuses = await page.evaluate(async () => {
      const body = JSON.stringify({ currentPassword: "Reset journey password 123!", newPassword: "Changed journey password 123!" });
      const csrf = document.cookie.split("; ").find(value => value.startsWith("__Host-swiftmc_csrf="))!.split("=").slice(1).join("=");
      const rejected = await fetch("/api/user/password", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const changed = await fetch("/api/user/password", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body });
      return [rejected.status, changed.status];
    });
    expect(statuses).toEqual([403, 200]);
    await page.goto("/account");
    await expect(page).toHaveURL("/login?callbackUrl=%2Faccount");
    await login(page, email, "Changed journey password 123!");
    await expect(page).toHaveURL("/account");
  });
  expect(errors).toEqual([]);
});
