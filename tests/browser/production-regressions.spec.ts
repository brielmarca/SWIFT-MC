import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Visual/navigation checks must not contact the Minecraft server in either runtime.
  await page.route("**/api/server-status", (route) => route.fulfill({
    json: { online: false, players: null, maxPlayers: null, version: null, publicAddress: "play.example.test" },
  }));
});

async function expectTarget(page: Page, id: string) {
  const label = id.startsWith("discord") ? "Discord" : "Servidor";
  await expect(page.getByRole("tab", { name: label, exact: true })).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate((targetId) => {
    const target = document.getElementById(targetId);
    if (!target || !target.checkVisibility()) return false;
    const top = target.getBoundingClientRect().top;
    return document.activeElement === target && top >= 100 && top < window.innerHeight;
  }, id)).toBe(true);
}

for (const id of ["servidor-1.1", "servidor-3.1", "servidor-5.2", "servidor-11.7", "discord-1.1", "discord-7.4", "discord-8"]) {
  test(`direct load and copied URL: ${id}`, async ({ page }) => {
    await page.goto(`/rules#${id}`);
    await expectTarget(page, id);
    await page.goto(page.url());
    await expectTarget(page, id);
    const ids = await page.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
}

test("filtered section links, hash history and keyboard tabs", async ({ page }) => {
  await page.goto("/rules#servidor-5.2");
  await expectTarget(page, "servidor-5.2");
  await page.getByRole("searchbox", { name: /Buscar em Servidor/ }).fill("respeito");
  await page.getByRole("navigation", { name: "Seções — Servidor" }).getByRole("link", { name: /§5/ }).click();
  await expect(page.getByRole("searchbox", { name: /Buscar em Servidor/ })).toHaveValue("");
  await expect(page.getByRole("link", { name: /Link direto/ })).toHaveCount(0);
  await page.evaluate(() => { location.hash = "servidor-5.2"; });
  await expectTarget(page, "servidor-5.2");
  await page.evaluate(() => { location.hash = "discord-7.4"; });
  await expectTarget(page, "discord-7.4");
  await page.goBack();
  await expectTarget(page, "servidor-5.2");
  await page.goForward();
  await expectTarget(page, "discord-7.4");
  await page.getByRole("tab", { name: "Discord", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "Servidor", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Servidor", exact: true })).toHaveAttribute("aria-selected", "true");
});

for (const [route, section, subtopic] of [
  ["/play", "Jogar", "Como jogar"],
  ["/ranks/swift", "Loja", "VIPs"],
  ["/community", "Comunidade", "Visão geral"],
  ["/rules", "Recursos", "Regras"],
]) {
  test(`contextual navigation: ${route}`, async ({ page }, testInfo) => {
    await page.goto(route);
    const subnav = page.getByRole("navigation", { name: `Subtópicos — ${section}` });
    await expect(subnav.getByRole("link", { name: subtopic, exact: true })).toHaveAttribute("aria-current", "page");
    if (testInfo.project.name === "desktop") {
      const mainNav = page.getByRole("navigation", { name: "Navegação principal" });
      await expect(mainNav.getByRole("link", { name: section, exact: true })).toHaveAttribute("aria-current", "true");
      await expect(mainNav.locator("svg")).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const link of await subnav.getByRole("link").all()) {
      const bounds = await link.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
  });
}

for (const route of ["/", "/store", "/ranks/swift", "/ranks/eclipse", "/ranks/cosmic", "/ranks/overdrive"]) {
  test(`current artwork loads: ${route}`, async ({ page }) => {
    await page.goto(route);
    const slugs = route.startsWith("/ranks/") ? [route.split("/").at(-1)!] : ["swift", "eclipse", "cosmic", "overdrive"];
    for (const slug of slugs) {
      const image = page.getByRole("img", { name: `Arte do rank ${slug}`, exact: false });
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      expect(decodeURIComponent(await image.evaluate((node: HTMLImageElement) => node.currentSrc))).toContain(`/brand/ranks/${slug}-v2.jpeg`);
    }
  });
}
