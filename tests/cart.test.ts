import assert from "node:assert/strict";
import test from "node:test";
import { getCartRanks, getCartSubtotal, parseCart } from "@/lib/cart";
import { ranks } from "@/data/ranks";

test("parses only unique rank slugs from persisted cart data", () => {
  assert.deepEqual(parseCart('["swift","swift","invalid","eclipse"]'), ["swift", "eclipse"]);
  assert.deepEqual(parseCart("not-json"), []);
  assert.deepEqual(parseCart('{"swift":true}'), []);
});

test("derives cart products and subtotal from the rank catalog", () => {
  const items = getCartRanks(["swift", "eclipse"]);

  assert.deepEqual(items.map((rank) => rank.name), ["Swift", "Eclipse"]);
  assert.equal(getCartSubtotal(items), null);
  assert.equal(getCartSubtotal(ranks), null);
  for (const rank of ranks) {
    assert.equal(rank.priceCents, null);
    assert.equal(rank.price, null);
  }
});

test("an unpriced item never produces a misleading zero or partial total", () => {
  assert.equal(getCartSubtotal([{ priceCents: 100 }, { priceCents: null }]), null);
  assert.equal(getCartSubtotal([{ priceCents: null }]), null);
  assert.equal(getCartSubtotal([]), 0);
});
