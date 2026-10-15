import assert from "node:assert/strict";
import test from "node:test";

import { getRank } from "@/data/ranks";
import { validateOrderInput } from "@/lib/orders/order-input";

for (const rankSlug of ["swift", "eclipse", "cosmic", "overdrive"] as const) {
  test(`uses canonical ${rankSlug} pricing even when the client supplies a price`, () => {
    const result = validateOrderInput({
      rankSlug,
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
      priceCents: 1,
      totalCents: 1,
      price: "R$ 0,01/mês",
      rank: { slug: rankSlug, priceCents: 1 },
    });

    assert.ok(result.data);
    assert.deepEqual(result.data.rank, getRank(rankSlug));
    assert.equal("totalCents" in result.data, false);
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
      rankSlug: "swift",
      minecraftUsername: "player;/op",
      email: "player@example.com",
    }),
    { error: "INVALID_INPUT" },
  );
});

test("rejects an invalid email", () => {
  assert.deepEqual(
    validateOrderInput({
      rankSlug: "swift",
      minecraftUsername: "ValidPlayer",
      email: "not-an-email",
    }),
    { error: "INVALID_INPUT" },
  );
});

test("normalizes valid details while retaining canonical pricing", () => {
  const result = validateOrderInput({
    rankSlug: "eclipse",
    minecraftUsername: "  BedRock   Player  ",
    email: "  Player@Example.COM ",
  });

  assert.ok(result.data);
  assert.equal(result.data.minecraftUsername, "BedRock   Player");
  assert.equal(result.data.email, "player@example.com");
  assert.deepEqual(result.data.rank, getRank("eclipse"));
});

for (const minecraftUsername of ["Player\nName", "Player\tName", "Player\0Name", "player;/op"]) {
  test(`rejects unsafe Minecraft username ${JSON.stringify(minecraftUsername)}`, () => {
    assert.deepEqual(
      validateOrderInput({
        rankSlug: "swift",
        minecraftUsername,
        email: "player@example.com",
      }),
      { error: "INVALID_INPUT" },
    );
  });
}
