import assert from "node:assert/strict";
import test from "node:test";
import { addRecentSearch, parseRecentSearches, MAX_RECENT_SEARCHES } from "@/lib/recent-searches";
import { findMatchRanges, getSearchWords, MAX_RESULTS_PER_GROUP, SEARCH_GROUPS, searchSite, snippetAround } from "@/lib/site-search";

const NOW = Date.parse("2026-10-06T12:00:00Z");
const groupIds = SEARCH_GROUPS.map((group) => group.id);

test("results are grouped by type, in a stable order, and capped per category", () => {
  const groups = searchSite("a", NOW);
  assert.ok(groups.length >= 3, "a broad query returns several groups");
  const returned = groups.map((group) => group.id);
  assert.equal(new Set(returned).size, returned.length, "no duplicated groups");
  assert.deepEqual(returned, groupIds.filter((id) => returned.includes(id)), "groups follow the defined order");
  for (const group of groups) {
    assert.ok(group.items.length > 0 && group.items.length <= MAX_RESULTS_PER_GROUP[group.id], `${group.id} respects its limit`);
    assert.equal(group.label, SEARCH_GROUPS.find((entry) => entry.id === group.id)?.label);
    for (const item of group.items) assert.ok(item.href.startsWith("/"), "local hrefs only");
  }
  assert.deepEqual(searchSite("   ", NOW), [], "blank queries return nothing");
});

test("news search reuses published posts, newest best match first, drafts hidden", () => {
  const groups = searchSite("economia", NOW);
  const news = groups.find((group) => group.id === "noticias");
  assert.ok(news);
  assert.equal(news.items[0].id, "noticias:atualizacao-economia-v2", "title matches rank above excerpt matches");
  assert.equal(news.items[0].href, "/news/atualizacao-economia-v2");
  const drafts = searchSite("rascunho", NOW);
  assert.ok(!drafts.some((group) => group.id === "noticias" || group.id === "eventos"), "draft news and draft events are never searchable");
  const accentless = searchSite("atualizacao", NOW).find((group) => group.id === "noticias");
  assert.ok(accentless?.items.some((item) => item.href === "/news/atualizacao-economia-v2"), "accent-insensitive matching");
});

test("rules and FAQ results deep-link to their anchors", () => {
  const rule = searchSite("trapaças", NOW).find((group) => group.id === "regras");
  assert.ok(rule?.items.some((item) => item.href === "/rules#R03"));
  const byId = searchSite("R01", NOW).find((group) => group.id === "regras");
  assert.equal(byId?.items[0].href, "/rules#R01", "searching by rule ID works");
  const faq = searchSite("versão", NOW).find((group) => group.id === "faq");
  assert.ok(faq?.items.some((item) => item.href === "/faq#versao"));
});

test("events appear by title and description, drafts excluded", () => {
  const event = searchSite("corrida", NOW).find((group) => group.id === "eventos");
  assert.ok(event?.items.some((item) => item.href === "/events" && item.title === "Corrida do Ender"));
  const past = searchSite("duelo de chefs", NOW).find((group) => group.id === "eventos");
  assert.ok(past, "past events remain searchable");
  const draft = searchSite("feira de trocas", NOW);
  assert.ok(!draft.some((group) => group.id === "eventos"), "draft events are excluded");
});

test("published wiki guides appear in global search under their own group", () => {
  const wiki = searchSite("comandos", NOW).find((group) => group.id === "wiki");
  assert.equal(wiki?.label, "Wiki", "grouped under Wiki");
  assert.ok(wiki?.items.some((item) => item.href === "/wiki/comandos-essenciais"), "guides link to /wiki/<slug>");
  const entered = searchSite("entrar no servidor", NOW).find((group) => group.id === "wiki");
  assert.ok(entered?.items.some((item) => item.href === "/wiki/como-entrar-no-servidor"), "matching into section content");
  const pages = searchSite("wiki", NOW).find((group) => group.id === "paginas");
  assert.ok(pages?.items.some((item) => item.href === "/wiki"), "the wiki hub itself is a page result");
});

test("static player utility pages and the store are searchable from their nav labels", () => {
  const pages = searchSite("status", NOW).find((group) => group.id === "paginas");
  assert.ok(pages?.items.some((item) => item.href === "/status"));
  const store = searchSite("loja", NOW).find((group) => group.id === "paginas");
  assert.ok(store?.items.some((item) => item.href === "/store"), "store pages are results; the store keeps its own product search");
  const ranking = searchSite("ranking", NOW).find((group) => group.id === "paginas");
  assert.ok(ranking?.items.some((item) => item.href === "/leaderboards"));
});

test("player lookup is offered only for valid Java usernames, without any remote request", () => {
  const player = searchSite("Steve_99", NOW);
  const group = player.find((entry) => entry.id === "jogador");
  assert.deepEqual(group?.items, [{ id: "jogador:perfil", group: "jogador", title: "Buscar jogador: Steve_99", href: "/player/Steve_99", meta: "Perfil público" }]);
  for (const invalid of ["ab", "inv@lid", "com espaço", "a".repeat(17)]) {
    assert.ok(!searchSite(invalid, NOW).some((entry) => entry.id === "jogador"), `"${invalid}" offers no player lookup`);
  }
});

test("highlight ranges are accent- and case-insensitive, merged and ordered", () => {
  assert.deepEqual(getSearchWords("  Olá MUNDO "), ["ola", "mundo"]);
  assert.deepEqual(findMatchRanges("Atualização da economia", "economia"), [[15, 23]]);
  assert.deepEqual(findMatchRanges("Atualização da economia", "atualizacao"), [[0, 11]]);
  assert.deepEqual(findMatchRanges("Mapa limpo", "MAPA"), [[0, 4]]);
  assert.deepEqual(findMatchRanges("Atenção", "atencao"), [[0, 7]]);
  assert.deepEqual(findMatchRanges("regras do chat", "chat regras"), [[0, 6], [10, 14]]);
  assert.deepEqual(findMatchRanges("vip v", "vip v"), [[0, 3], [4, 5]], "overlapping words merge");
  assert.deepEqual(findMatchRanges("Temporada 4", "xyz"), [], "no match means no ranges");
  assert.deepEqual(findMatchRanges("", "vip"), []);
});

test("snippets stay compact around the first match", () => {
  const long = `${"x".repeat(80)} servidor ${"y".repeat(80)}`;
  const windowed = snippetAround(long, findMatchRanges(long, "servidor"), 60);
  assert.ok(windowed.length <= 63, "windowed snippet respects the limit");
  assert.ok(windowed.includes("…"), "trimmed snippets show ellipses");
  assert.ok(windowed.includes("servidor"), "the match stays inside the window");
  assert.equal(snippetAround("curto", [], 60), "curto", "short text is untouched");
});

test("recent searches are local-only, deduplicated, capped and tolerant of bad data", () => {
  assert.deepEqual(parseRecentSearches(null), []);
  assert.deepEqual(parseRecentSearches("not json"), []);
  assert.deepEqual(parseRecentSearches('{"a":1}'), []);
  assert.deepEqual(parseRecentSearches('["VIP","vip","  VIP  ",42,""]'), ["VIP"], "case-insensitive dedupe, non-strings skipped");
  assert.equal(parseRecentSearches(JSON.stringify(Array.from({ length: 20 }, (_, index) => `busca-${index}`))).length, MAX_RECENT_SEARCHES);
  assert.deepEqual(parseRecentSearches(`["${"a".repeat(5000)}"]`), [], "oversized payloads are rejected");
  assert.deepEqual(addRecentSearch(["b", "a"], " B  "), ["B", "a"], "repeated searches move to the front");
  assert.deepEqual(addRecentSearch(["b"], "   "), ["b"], "blank queries never persist");
  assert.deepEqual(parseRecentSearches('["buscar \\"vip\\""]'), ['buscar "vip"'], "queries with quotes survive a round trip");
});
