import assert from "node:assert/strict";
import test from "node:test";
import { getCartRanks, getCartSubtotal, parseCart } from "@/lib/cart";
import { formatMonthlyPrice, ranks } from "@/data/ranks";

test("parses only unique rank slugs from persisted cart data", () => {
  assert.deepEqual(parseCart('["swift","swift","invalid","eclipse"]'), ["swift", "eclipse"]);
  assert.deepEqual(parseCart("not-json"), []);
  assert.deepEqual(parseCart('{"swift":true}'), []);
});

test("derives cart products and subtotal from the rank catalog", () => {
  const items = getCartRanks(["swift", "eclipse"]);

  assert.deepEqual(items.map((rank) => rank.name), ["Swift", "Eclipse"]);
  assert.equal(getCartSubtotal(items), 5500);
  assert.equal(getCartSubtotal(ranks), 21500);
  assert.equal(Number.isInteger(getCartSubtotal(ranks)), true);
  assert.equal(formatMonthlyPrice(getCartSubtotal(ranks)), "R$ 215,00/mês");
  assert.equal(formatMonthlyPrice(getCartSubtotal(items)), "R$ 55,00/mês");
});

test("every cart combination sums canonical prices in integer cents", () => {
  for (let mask = 0; mask < 1 << ranks.length; mask++) {
    const selected = ranks.filter((_, index) => mask & (1 << index));
    const items = getCartRanks(parseCart(JSON.stringify(selected.map((rank) => rank.slug))));
    const total = getCartSubtotal(items);
    assert.equal(total, selected.reduce((sum, rank) => sum + rank.priceCents!, 0));
    assert.ok(Number.isInteger(total));
  }
});

test("persisted client prices cannot override canonical cart prices", () => {
  const slugs = parseCart(JSON.stringify([
    { slug: "swift", priceCents: 1, price: "R$ 0,01/mês" },
    "swift",
    "overdrive",
  ]));
  assert.deepEqual(slugs, ["swift", "overdrive"]);
  assert.equal(getCartSubtotal(getCartRanks(slugs)), 11500);
});

test("an unpriced item never produces a misleading zero or partial total", () => {
  assert.equal(getCartSubtotal([{ priceCents: 100 }, { priceCents: null }]), null);
  assert.equal(getCartSubtotal([{ priceCents: null }]), null);
  assert.equal(getCartSubtotal([]), 0);
});
