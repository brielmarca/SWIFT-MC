import assert from "node:assert/strict";
import test from "node:test";
import { faqs, filterGuides, rules } from "@/data/player-guides";

test("rule anchors are unique and URL-safe", () => {
  for (const entries of [rules, faqs]) {
    assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
    for (const entry of entries) assert.match(entry.id, /^[a-zA-Z0-9-]+$/);
  }
});

test("guides search IDs, body and accents without case sensitivity", () => {
  assert.deepEqual(filterGuides(rules, " r01 ", "Todas").map((entry) => entry.id), ["R01"]);
  assert.ok(filterGuides(rules, "DUPLICACOES", "Todas").some((entry) => entry.id === "R04"));
  assert.ok(filterGuides(faqs, "versao minecraft", "Todas").some((entry) => entry.id === "versao"));
});

test("category and text filters combine, with recoverable empty results", () => {
  assert.equal(filterGuides(faqs, "versão", "VIPs").length, 0);
  assert.ok(filterGuides(faqs, "", "VIPs").every((entry) => entry.category === "VIPs"));
  assert.equal(filterGuides(faqs, "", "Todas").length, faqs.length);
  assert.equal(filterGuides(rules, "no-such-rule", "Todas").length, 0);
});
