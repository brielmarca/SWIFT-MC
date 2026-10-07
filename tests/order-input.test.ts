import assert from "node:assert/strict";
import test from "node:test";

import { validateOrderInput } from "@/lib/orders/order-input";

for (const [rankSlug, expectedPriceCents] of [
  ["vip", 1990],
  ["vip-plus", 3990],
  ["mvp", 6990],
] as const) {
  test(`validates a ${rankSlug} order against the authoritative catalog`, () => {
    const result = validateOrderInput({
      rankSlug,
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
    });

    assert.equal(result.error, undefined);
    assert.equal(result.data?.rank.slug, rankSlug);
    assert.equal(result.data?.rank.priceCents, expectedPriceCents);
  });
}

test("rejects an unknown rank", () => {
  assert.deepEqual(
    validateOrderInput({
      rankSlug: "admin",
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
    }),
    { error: "UNKNOWN_RANK" },
  );
});

test("rejects an invalid Minecraft username", () => {
  assert.deepEqual(
    validateOrderInput({
      rankSlug: "vip",
      minecraftUsername: "player;/op",
      email: "player@example.com",
    }),
    { error: "INVALID_INPUT" },
  );
});

test("rejects an invalid email", () => {
  assert.deepEqual(
    validateOrderInput({
      rankSlug: "vip",
      minecraftUsername: "ValidPlayer",
      email: "not-an-email",
    }),
    { error: "INVALID_INPUT" },
  );
});

test("trims Minecraft outer whitespace without changing casing or internal spacing", () => {
  const result = validateOrderInput({
    rankSlug: "vip-plus",
    minecraftUsername: "  BedRock   Player  ",
    email: "  Player@Example.COM ",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.data?.minecraftUsername, "BedRock   Player");
  assert.equal(result.data?.email, "player@example.com");
});

for (const minecraftUsername of ["Player\nName", "Player\tName", "Player\0Name", "player;/op"]) {
  test(`rejects unsafe Minecraft username ${JSON.stringify(minecraftUsername)}`, () => {
    assert.deepEqual(
      validateOrderInput({
        rankSlug: "vip",
        minecraftUsername,
        email: "player@example.com",
      }),
      { error: "INVALID_INPUT" },
    );
  });
}
