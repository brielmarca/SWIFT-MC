import assert from "node:assert/strict";
import test from "node:test";
import { getCartRanks, getCartSubtotal, parseCart } from "@/lib/cart";

test("parses only unique rank slugs from persisted cart data", () => {
  assert.deepEqual(parseCart('["swift","swift","invalid","eclipse"]'), ["swift", "eclipse"]);
  assert.deepEqual(parseCart("not-json"), []);
  assert.deepEqual(parseCart('{"swift":true}'), []);
});

test("derives cart products and subtotal from the rank catalog", () => {
  const items = getCartRanks(["swift", "eclipse"]);

  assert.deepEqual(items.map((rank) => rank.name), ["Swift", "Eclipse"]);
  assert.equal(getCartSubtotal(items), 0);
});