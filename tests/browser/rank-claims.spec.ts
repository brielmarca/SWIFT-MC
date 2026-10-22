import { expect, test } from "@playwright/test";
import { ranks } from "../../data/ranks";

const welcomeClaims = { swift: 500, eclipse: 1500, cosmic: 4000, overdrive: 10000 };
const obsoleteClaims = [250, 1000, 750, 3000, 2500, 8000, 6000, 20000, 2000, 5000];
const claimLabel = "Blocos de claim — Boas-vindas (resgate único)";

for (const rank of ranks) {
  test(`${rank.name} renders only Welcome claims and preserves all other kit rewards`, async ({ page }) => {
    await page.goto(`/ranks/${rank.slug}`);
    const kits = page.getByRole("region", { name: "Kits", exact: true });
    for (const [title, kit] of [
      ["Kit Diário", rank.dailyKit],
      ["Kit Semanal", rank.weeklyKit],
      ["Kit Mensal", rank.monthlyKit],
      ["Kit de Boas-vindas", rank.welcomeKit],
    ] as const) {
      const accordion = kits.locator("details").filter({ has: page.locator("summary").filter({ hasText: title }) });
      if (await accordion.getAttribute("open") === null) {
        await accordion.locator("summary").click();
      }
      await expect(accordion.locator("summary")).toContainText(kit.cooldown);
      if (title === "Kit de Boas-vindas") {
        await expect(accordion.getByText(`${welcomeClaims[rank.slug].toLocaleString("pt-BR")} blocos de claim`, { exact: true })).toBeVisible();
      } else {
        await expect(accordion.getByText(/claim/i)).toHaveCount(0);
      }
      for (const item of kit.items) {
        const reward = accordion.getByRole("listitem").filter({ hasText: `${item.quantity}x ${item.name}` });
        await expect(reward).toBeVisible();
        for (const enchantment of item.enchantments ?? []) await expect(reward).toContainText(enchantment);
      }
      if (kit.money) await expect(accordion.getByText(`${kit.money.toLocaleString("pt-BR")} moedas do jogo`, { exact: true })).toBeVisible();
      if (kit.mcmmoXp) await expect(accordion.getByText(`${kit.mcmmoXp.toLocaleString("pt-BR")} de XP no mcMMO`, { exact: true })).toBeVisible();
    }
    for (const value of obsoleteClaims) {
      await expect(page.getByText(`${value.toLocaleString("pt-BR")} blocos de claim`, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText("Blocos de claim/mês", { exact: true })).toHaveCount(0);
    const summary = page.locator("dl > div").filter({ hasText: claimLabel });
    await expect(summary.locator("dd")).toHaveText(welcomeClaims[rank.slug].toLocaleString("pt-BR"));
    const comparison = page.getByRole("row").filter({ hasText: claimLabel });
    await expect(comparison.getByRole("cell")).toHaveText(["500", "1.500", "4.000", "10.000"]);
  });
}

test("store cards retain official prices without advertising recurring claims", async ({ page }) => {
  await page.goto("/store");
  for (const rank of ranks) {
    const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: rank.name, exact: true }) });
    await expect(card.getByText(rank.price!, { exact: true })).toBeVisible();
    await expect(card.getByText(/claim/i)).toHaveCount(0);
  }
  await expect(page.getByText("Blocos de claim/mês", { exact: true })).toHaveCount(0);
});
