import assert from "node:assert/strict";
import test from "node:test";
import {
  filterWikiGuides,
  getAdjacentGuides,
  getFeaturedGuides,
  getGuideBySlug,
  getGuideSearchText,
  getPublishedGuides,
  getRelatedGuides,
  getWikiCategoryCounts,
  isGuideVisible,
  wikiGuides,
  WIKI_CATEGORIES,
  type WikiGuide,
} from "@/data/wiki";

const sampleGuide = (overrides: Partial<WikiGuide> = {}): WikiGuide => ({
  slug: "guia-exemplo",
  title: "Guia exemplo",
  category: "Survival",
  description: "Descrição.",
  sections: [{ id: "unico", title: "Seção", blocks: [{ type: "paragraph", text: "Texto." }] }],
  ...overrides,
});

test("sample guides cover the required preview topics with stable structure", () => {
  const slugs = wikiGuides.map((guide) => guide.slug);
  assert.deepEqual(
    [...slugs].sort(),
    ["comandos-essenciais", "como-entrar-no-servidor", "como-funciona-a-economia", "como-funcionam-os-ranks", "guia-do-survival"].sort(),
    "the five preview guides exist",
  );
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, slug);
  assert.equal(new Set(slugs).size, slugs.length, "slugs are unique");
  for (const guide of wikiGuides) {
    assert.ok(WIKI_CATEGORIES.includes(guide.category), `${guide.slug} uses a canonical category`);
    assert.ok(guide.description.length > 0 && guide.sections.length > 0);
    const sectionIds = guide.sections.map((section) => section.id);
    assert.equal(new Set(sectionIds).size, sectionIds.length, `${guide.slug} has unique section anchors`);
    for (const id of sectionIds) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, id);
    for (const slug of guide.related ?? []) assert.ok(slugs.includes(slug), `${guide.slug} related "${slug}" resolves`);
    for (const section of guide.sections) {
      assert.ok(section.blocks.length > 0, `${guide.slug}#${section.id} has content`);
      for (const block of section.blocks) {
        if (block.type === "table") {
          assert.ok(block.headers.length >= 2);
          for (const row of block.rows) assert.equal(row.length, block.headers.length, "table rows match headers");
        }
        if (block.type === "command") assert.match(block.command, /^\/\S/, "commands start with /");
        if (block.type === "links") for (const item of block.items) assert.ok(item.href.startsWith("/"), "internal links only");
        if (block.type === "bullets" || block.type === "steps") assert.ok(block.items.length > 0);
      }
    }
  }
  const blockTypes = new Set(wikiGuides.flatMap((guide) => guide.sections.flatMap((section) => section.blocks.map((block) => block.type))));
  assert.deepEqual([...blockTypes].sort(), ["bullets", "callout", "command", "links", "paragraph", "steps", "table"], "all block types are previewed");
});

test("draft guides are hidden from every query, missing status means published", () => {
  const draft = sampleGuide({ slug: "rascunho-guia", status: "draft" });
  const plain = sampleGuide({ slug: "sem-status" });
  assert.equal(isGuideVisible(draft), false);
  assert.equal(isGuideVisible(plain), true, "status defaults to published");
  const guides = [plain, draft];
  assert.deepEqual(getPublishedGuides(guides).map((guide) => guide.slug), ["sem-status"]);
  assert.equal(getGuideBySlug("rascunho-guia", guides), undefined, "drafts 404");
  assert.equal(getGuideBySlug("guia-inexistente", guides), undefined, "unknown slugs 404");
  assert.equal(getGuideBySlug("sem-status", guides)?.slug, "sem-status");
  assert.deepEqual(getRelatedGuides(plain, 3, guides).map((guide) => guide.slug), [], "drafts never surface as related");
});

test("search text and filters match across titles, sections and commands", () => {
  const text = getGuideSearchText(wikiGuides[0]);
  assert.ok(text.includes("Como entrar no servidor") && text.includes("Primeiros passos"));
  assert.ok(getGuideSearchText(wikiGuides[1]).includes("/sethome"), "commands are searchable");
  assert.ok(filterWikiGuides(wikiGuides, { query: "COMANDOS" }).some((guide) => guide.slug === "comandos-essenciais"), "accent/case-insensitive");
  assert.ok(filterWikiGuides(wikiGuides, { query: "entrar servidor" }).some((guide) => guide.slug === "como-entrar-no-servidor"), "word-AND matching");
  assert.ok(filterWikiGuides(wikiGuides, { query: "golpes" }).some((guide) => guide.slug === "como-funciona-a-economia"), "section body text matches");
  const byCategory = filterWikiGuides(wikiGuides, { category: "Comandos" });
  assert.ok(byCategory.length > 0 && byCategory.every((guide) => guide.category === "Comandos"));
  assert.ok(filterWikiGuides(wikiGuides, { category: "Comandos", query: "economia" }).every((guide) => guide.category === "Comandos"), "filters combine");
  assert.deepEqual(filterWikiGuides(wikiGuides, { query: "termo-que-nao-existe-zzz" }), [], "empty result is possible");
  assert.equal(filterWikiGuides(wikiGuides, {}).length, wikiGuides.length);
});

test("featured, related and category counts come from visible guides only", () => {
  const featured = getFeaturedGuides();
  assert.ok(featured.length >= 1 && featured.length <= 3);
  assert.ok(featured.every((guide) => guide.featured));
  assert.deepEqual(getFeaturedGuides(0), []);

  const guide = getGuideBySlug("como-entrar-no-servidor");
  assert.ok(guide);
  const related = getRelatedGuides(guide);
  assert.ok(related.length > 0 && related.length <= 3);
  assert.ok(!related.some((item) => item.slug === guide.slug));
  assert.deepEqual(related.map((item) => item.slug), (guide.related ?? []).slice(0, 3), "explicit related slugs come first");
  assert.deepEqual(getRelatedGuides(guide, 0), []);
  const orphan = sampleGuide({ slug: "orfao", category: "Eventos", related: ["guia-inexistente"] });
  assert.deepEqual(getRelatedGuides(orphan, 3, [orphan]), [], "no same-category fallback available");

  const counts = getWikiCategoryCounts();
  assert.equal(counts.length, WIKI_CATEGORIES.length, "every canonical category is listed, even empty ones");
  assert.equal(counts.reduce((total, entry) => total + entry.count, 0), getPublishedGuides().length);
  assert.deepEqual(counts.map((entry) => entry.category), [...WIKI_CATEGORIES], "counts follow canonical order");
});

test("previous/next navigate within the category and stop at the edges", () => {
  const guides = [
    sampleGuide({ slug: "ev-um", category: "Eventos" }),
    sampleGuide({ slug: "cmd-x", category: "Comandos" }),
    sampleGuide({ slug: "ev-dois", category: "Eventos" }),
    sampleGuide({ slug: "ev-tres", category: "Eventos" }),
    sampleGuide({ slug: "sozinho", category: "Segurança" }),
  ];
  assert.equal(getAdjacentGuides("ev-um", guides).previous, undefined, "the first guide has no previous");
  assert.equal(getAdjacentGuides("ev-um", guides).next?.slug, "ev-dois", "neighbours skip other categories");
  const middle = getAdjacentGuides("ev-dois", guides);
  assert.equal(middle.previous?.slug, "ev-um");
  assert.equal(middle.next?.slug, "ev-tres");
  assert.equal(getAdjacentGuides("ev-tres", guides).next, undefined, "the last guide has no next");
  assert.equal(getAdjacentGuides("sozinho", guides).previous, undefined);
  assert.equal(getAdjacentGuides("sozinho", guides).next, undefined, "a lone guide has no neighbours");
  assert.deepEqual(getAdjacentGuides("guia-inexistente", guides), {}, "unknown slugs have no neighbours");
  const firstSample = getAdjacentGuides("como-entrar-no-servidor");
  assert.equal(firstSample.previous, undefined);
  assert.equal(firstSample.next, undefined, "sample guides use unique categories, so edges apply");
});
