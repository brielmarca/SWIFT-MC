import assert from "node:assert/strict";
import test from "node:test";
import { formatMonthlyPrice, ranks } from "@/data/ranks";

test("all four ranks have the official integer-cent monthly prices", () => {
  assert.deepEqual(ranks.map(({ slug, priceCents, duration, price }) => ({ slug, priceCents, duration, price })), [
    { slug: "swift", priceCents: 2000, duration: "Mensal", price: "R$ 20,00/mês" },
    { slug: "eclipse", priceCents: 3500, duration: "Mensal", price: "R$ 35,00/mês" },
    { slug: "cosmic", priceCents: 6500, duration: "Mensal", price: "R$ 65,00/mês" },
    { slug: "overdrive", priceCents: 9500, duration: "Mensal", price: "R$ 95,00/mês" },
  ]);
});

test("monthly formatting preserves cents and does not invent unavailable prices", () => {
  assert.equal(formatMonthlyPrice(12345), "R$ 123,45/mês");
  assert.equal(formatMonthlyPrice(0), "R$ 0,00/mês");
  for (const cents of [null, -1, 1.5, NaN, Infinity]) {
    assert.equal(formatMonthlyPrice(cents), null);
  }
});
