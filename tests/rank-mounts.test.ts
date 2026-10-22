import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { getRankMounts, mountCatalog, ranks } from "../data/ranks";

const expected = {
  swift: ["Corcel Safira"],
  eclipse: ["Corcel Safira", "Lobo do Eclipse"],
  cosmic: ["Corcel Safira", "Lobo do Eclipse", "Cervo Astral", "Grifo Celestial"],
  overdrive: ["Corcel Safira", "Lobo do Eclipse", "Cervo Astral", "Grifo Celestial", "Tigre Relâmpago", "Dragão da Tempestade"],
};
// Baseline captured before adding mounts: protects all existing VIP fields,
// including prices, claims, kits, commands, cosmetics and mcMMO bonuses.
const originalRanks = {
  swift: "f6d0a3cd2d2e1da8d029028dede00acbb352c143f3772b3d1e7c75a94df8cb33",
  eclipse: "3fd8ae683c29dde2b3d5a45921de6913e9c8337a5ee12d2ea7134132088f98ff",
  cosmic: "92a73015ea8146b5da84923ee641a3676808bc60d4f4fae6a55bbbe89f26cadd",
  overdrive: "cf2a96f183b67b04faa426357b3441ee3311cc0bf33d321c301c7feb4eb19aca",
};

for (const rank of ranks) {
  test(`${rank.name} has exactly the official confirmed mounts and correct inheritance`, () => {
    const mounts = getRankMounts(rank.slug);
    assert.deepEqual(mounts.map((mount) => mount.name), expected[rank.slug]);
    assert.ok(mounts.every((mount) => mount.confirmed));
    for (const mount of mounts) {
      const canonical = mountCatalog.find((entry) => entry.name === mount.name)!;
      const { inheritedFrom, ...data } = mount;
      assert.deepEqual(data, canonical);
      assert.equal(inheritedFrom, canonical.introducedAt === rank.slug ? undefined : canonical.introducedAt);
      assert.ok(!("image" in mount), `${mount.name} must be text-only (no image)`);
      assert.ok(typeof mount.name === "string" && mount.name.length > 0);
      assert.ok(typeof mount.description === "string" && mount.description.length > 0);
      assert.ok(mount.type === "terrestrial" || mount.type === "flying");
    }
    if (rank.inheritsFrom) {
      for (const parent of getRankMounts(rank.inheritsFrom)) {
        assert.ok(mounts.some((mount) => mount.name === parent.name));
      }
    }
  });

  test(`${rank.name} preserves every pre-existing VIP field`, () => {
    assert.equal(createHash("sha256").update(JSON.stringify(rank)).digest("hex"), originalRanks[rank.slug]);
  });
}

test("only the official griffin and dragon are flying; no unconfirmed cloud is published", () => {
  assert.equal(new Set(mountCatalog.map((mount) => mount.name)).size, 6);
  assert.deepEqual(mountCatalog.filter((mount) => mount.type === "flying").map((mount) => mount.name), ["Grifo Celestial", "Dragão da Tempestade"]);
  assert.ok(!mountCatalog.some((mount) => mount.name === "Nuvem Relâmpago" && mount.confirmed));
  for (const rank of ranks) assert.ok(!getRankMounts(rank.slug).some((mount) => mount.name === "Nuvem Relâmpago"));
});
