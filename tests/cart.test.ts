import assert from "node:assert/strict";
import test from "node:test";
import { getCartRanks, getCartSubtotal, parseCart } from "@/lib/cart";

test("parses only unique rank slugs from persisted cart data", () => {
  assert.deepEqual(parseCart('["vip","vip","invalid","mvp"]'), ["vip", "mvp"]);
  assert.deepEqual(parseCart("not-json"), []);
  assert.deepEqual(parseCart('{"vip":true}'), []);
});

test("derives cart products and subtotal from the rank catalog", () => {
  const items = getCartRanks(["vip", "vip-plus"]);

  assert.deepEqual(items.map((rank) => rank.name), ["VIP", "VIP+"]);
  assert.equal(getCartSubtotal(items), 5980);
});
