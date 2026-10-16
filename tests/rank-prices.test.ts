import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
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

test("comparison renders every canonical monthly price without a coming-soon placeholder", () => {
  const html = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    'import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { RankComparison } from "./components/rank-comparison.tsx"; process.stdout.write(renderToStaticMarkup(React.createElement(RankComparison)));',
  ], { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: "" }, encoding: "utf8" });
  assert.ok(html.includes("Preço mensal"));
  for (const rank of ranks) {
    assert.ok(rank.price);
    assert.ok(html.includes(rank.price), rank.slug);
  }
  assert.ok(!html.includes("Preço em breve"));
});
