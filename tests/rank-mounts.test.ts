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
// RC baseline: shared FAQ/benefit copy no longer claims automatic renewal
// (one-time 1-month VIP purchases). Prices, claims, kits, commands,
// cosmetics and mcMMO bonuses remain protected.
const originalRanks = {
  swift: "cf9617335da0ab20a67a3ca6c623e2c7e7d56844efc542724820a6ce04d600b0",
  eclipse: "a398f20ae6c5713a15f4b80c476ca12ca58c22fd00ab5093ca9a9489e4d4e5f4",
  cosmic: "af38c258a59057c7a30c58a4445ef5180559fc4337840328d9a15df6cef97bb3",
  overdrive: "436cf85585da3c04a7247b7af566f7fe65fba0c00b2988944055e32158fa6836",
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
