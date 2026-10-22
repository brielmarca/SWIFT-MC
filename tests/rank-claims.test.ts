import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { ranks } from "../data/ranks";

const welcomeClaims = { swift: 500, eclipse: 1500, cosmic: 4000, overdrive: 10000 };

// Captured before the claim-policy update, excluding only claimBlocks.
// Covers every item, quantity, enchantment, money/XP reward and cooldown in all four kits.
const originalKitFingerprints = {
  swift: "a9166396e10964937f8ba679606f7ca7d2a76137a5202b4485d04624c3a0c651",
  eclipse: "8bff4510319c3ad2f702a7bad28e5daaa68a9f547f33eed9310d3145f46fbb96",
  cosmic: "578afc23080622feff9fceec934781f6f2c1016fff768d34925af81e2542cd6e",
  overdrive: "b262dd4dd853ac06902f83e271340e4ec5d7af766adc49b83f6e1546681709ca",
};

for (const rank of ranks) {
  test(`${rank.name} grants claims exclusively in the one-time Welcome kit`, () => {
    for (const key of ["dailyKit", "weeklyKit", "monthlyKit"] as const) {
      assert.equal(rank[key].claimBlocks, undefined, `${key} has no claim reward`);
      assert.ok(!rank[key].items.some((item) => /claim/i.test(item.name)));
    }
    assert.equal(rank.welcomeKit.claimBlocks, welcomeClaims[rank.slug]);
    assert.equal(rank.welcomeKit.cooldown, "Resgate único");
  });

  test(`${rank.name} retains every non-claim kit reward and cooldown`, () => {
    const kits = [rank.dailyKit, rank.weeklyKit, rank.monthlyKit, rank.welcomeKit]
      .map((kit) => Object.fromEntries(Object.entries(kit).filter(([key]) => key !== "claimBlocks")));
    assert.equal(createHash("sha256").update(JSON.stringify(kits)).digest("hex"), originalKitFingerprints[rank.slug]);
  });
}
