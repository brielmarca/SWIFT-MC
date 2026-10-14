import assert from "node:assert/strict";
import test from "node:test";

import { validateOrderInput } from "@/lib/orders/order-input";

for (const rankSlug of ["swift", "eclipse", "cosmic", "overdrive"] as const) {
  test(`rejects unpriced ${rankSlug} even when the client supplies a price`, () => {
    const result = validateOrderInput({
      rankSlug,
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
      priceCents: 1,
    });

    assert.deepEqual(result, { error: "UNPRICED_RANK" });
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

test("valid whitespace-normalized details cannot bypass an unpriced rank", () => {
  const result = validateOrderInput({
    rankSlug: "eclipse",
    minecraftUsername: "  BedRock   Player  ",
    email: "  Player@Example.COM ",
  });

  assert.deepEqual(result, { error: "UNPRICED_RANK" });
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
