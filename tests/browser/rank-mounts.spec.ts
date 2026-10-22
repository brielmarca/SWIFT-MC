import { expect, test } from "@playwright/test";
import { getMountSummary, getRank, getRankMounts, ranks } from "../../data/ranks";

for (const rank of ranks) {
  test(`${rank.name} renders canonical mounts, descriptions and inheritance`, async ({ page }) => {
    await page.goto(`/ranks/${rank.slug}`);
    const section = page.getByRole("region", { name: "Montarias", exact: true });
    const mounts = getRankMounts(rank.slug);
    await expect(section.getByRole("article")).toHaveCount(mounts.length);
    for (const mount of mounts) {
      const card = section.getByRole("article").filter({ has: page.getByRole("heading", { name: mount.name, exact: true }) });
      await expect(card).toBeVisible();
      await expect(card.getByText(mount.type === "flying" ? "Voadora" : "Terrestre", { exact: true })).toBeVisible();
      await expect(card.getByText(mount.description, { exact: true })).toBeVisible();
      await expect(card.getByText(mount.inheritedFrom ? `Herdada do VIP ${getRank(mount.inheritedFrom)!.name}` : `Exclusiva do VIP ${rank.name}`, { exact: true })).toBeVisible();
      if (!mount.image) {
        await expect(card.getByText("SwiftMC · Arte indisponível", { exact: true })).toBeVisible();
        await expect(card.getByRole("img")).toHaveCount(0);
      } else {
        await expect(card.getByRole("img", { name: mount.name })).toBeVisible();
      }
    }
    await expect(page.getByText("Nuvem Relâmpago", { exact: false })).toHaveCount(0);
    const comparison = page.getByRole("row").filter({ hasText: "Montarias confirmadas (inclui herdadas)" });
    await expect(comparison.getByRole("cell")).toHaveText(["1 · 1 terrestre", "2 · 2 terrestres", "4 · 3 terrestres + 1 voadora", "6 · 4 terrestres + 2 voadoras"]);
  });
}

for (const path of ["/", "/store"]) {
  test(`${path} summarizes canonical mount counts without listing mounts on small cards`, async ({ page }) => {
    await page.goto(path);
    for (const rank of ranks) {
      const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: rank.name, exact: true }) });
      await expect(card.getByText(getMountSummary(rank.slug), { exact: true })).toBeVisible();
      await expect(card.getByText(rank.price!, { exact: true })).toBeVisible();
      for (const mount of getRankMounts(rank.slug)) await expect(card.getByText(mount.name, { exact: true })).toHaveCount(0);
    }
    await expect(page.getByText("Nuvem Relâmpago", { exact: false })).toHaveCount(0);
  });
}
