import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyEvents,
  eventPosts,
  filterNews,
  getActiveAnnouncement,
  getFeaturedNews,
  getLatestNews,
  getNewsBySlug,
  getNewsCategories,
  getNewsTags,
  getPublishedNews,
  getRelatedNews,
  isNewsVisible,
  newsPosts,
  siteAnnouncement,
  type EventPost,
  type NewsPost,
} from "@/data/content";
import { formatClockTime, formatEventRange, formatNewsDate, formatNewsShortDate } from "@/lib/content-format";

const NOW = Date.parse("2026-10-06T12:00:00Z");

const samplePost = (overrides: Partial<NewsPost> = {}): NewsPost => ({
  slug: "exemplo",
  title: "Título",
  excerpt: "Resumo",
  status: "published",
  publishedAt: "2026-10-01T12:00:00Z",
  category: "Atualizações",
  tags: ["aviso"],
  featured: false,
  content: [],
  ...overrides,
});

const sampleEvent = (overrides: Partial<EventPost> = {}): EventPost => ({
  slug: "evento-exemplo",
  title: "Evento",
  description: "Descrição",
  status: "published",
  startsAt: "2026-10-10T22:00:00Z",
  ...overrides,
});

test("sample content uses stable unique URL-safe slugs and local images", () => {
  const slugs = [...newsPosts.map((post) => post.slug), ...eventPosts.map((event) => event.slug)];
  assert.equal(new Set(slugs).size, slugs.length, "slugs are unique across news and events");
  for (const slug of slugs) assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, slug);
  for (const post of newsPosts) {
    if (post.image) assert.ok(post.image.src.startsWith("/") && !post.image.src.includes("://"), "images are local assets");
    assert.ok(post.content.length > 0, "every sample post has content");
    assert.ok(["Atualizações", "Comunidade", "Guias"].includes(post.category));
    assert.ok(post.tags.length > 0);
  }
  if (siteAnnouncement) assert.match(siteAnnouncement.id, /^[a-zA-Z0-9:_-]+$/);
});

test("draft and future posts never appear in the published listing", () => {
  const drafts = newsPosts.filter((post) => post.status === "draft");
  assert.ok(drafts.length > 0, "sample content includes a draft for preview");
  for (const draft of drafts) {
    assert.equal(getNewsBySlug(draft.slug, NOW), undefined);
    assert.ok(!getPublishedNews(NOW).some((post) => post.slug === draft.slug));
  }
  const future = samplePost({ publishedAt: "2026-12-01T12:00:00Z" });
  assert.equal(isNewsVisible(future, NOW), false, "scheduled post stays hidden before publishedAt");
  assert.equal(isNewsVisible(future, Date.parse("2026-12-01T12:00:01Z")), true, "scheduled post appears once the date passes");
  assert.equal(isNewsVisible(samplePost({ status: "draft" }), Date.now() + 10 ** 12), false);
});

test("published listing is sorted newest first with correct featured and latest picks", () => {
  const posts = getPublishedNews(NOW);
  assert.ok(posts.length >= 4, "several published samples are visible");
  for (let index = 1; index < posts.length; index += 1) {
    assert.ok(Date.parse(posts[index - 1].publishedAt) >= Date.parse(posts[index].publishedAt), "sorted descending");
  }
  const featured = getFeaturedNews(NOW);
  assert.ok(featured && featured.featured, "featured resolves to a visible featured post");
  assert.equal(getLatestNews(3, NOW).length, 3);
  assert.equal(getLatestNews(0, NOW).length, 0);
  assert.deepEqual(getLatestNews(3, NOW).map((post) => post.slug), posts.slice(0, 3).map((post) => post.slug));
});

test("news search is accent-insensitive and combines with category and tag filters", () => {
  const posts = getPublishedNews(NOW);
  assert.ok(filterNews(posts, { query: "TEMPORADA" }).some((post) => post.slug === "temporada-4-sobrevivencia"));
  assert.ok(filterNews(posts, { query: "economia leiloes" }).some((post) => post.slug === "atualizacao-economia-v2"));
  assert.equal(filterNews(posts, { category: "Guias" }).length, filterNews(posts, {}).filter((post) => post.category === "Guias").length);
  assert.ok(filterNews(posts, { category: "Guias" }).every((post) => post.category === "Guias"));
  assert.ok(filterNews(posts, { tag: "manutencao" }).every((post) => post.tags.includes("manutencao")));
  assert.equal(filterNews(posts, { query: "sem-resposta-possivel" }).length, 0, "empty result is possible");
  assert.ok(filterNews(posts, { category: "Guias", tag: "economia" }).length <= 1);
  assert.equal(filterNews(posts, {}).length, posts.length);
  assert.ok(getNewsCategories(posts).includes("Atualizações"));
  assert.ok(getNewsTags(posts).includes("manutencao"));
});

test("related news excludes itself, stays bounded and prefers matching category or tags", () => {
  const anchor = getNewsBySlug("temporada-4-sobrevivencia", NOW);
  assert.ok(anchor);
  const related = getRelatedNews(anchor, 3, NOW);
  assert.ok(related.length > 0 && related.length <= 3);
  assert.ok(!related.some((post) => post.slug === anchor.slug));
  assert.ok(related.every((post) => post.category === anchor.category || post.tags.some((tag) => anchor.tags.includes(tag))));
  assert.deepEqual(getRelatedNews(anchor, 0, NOW), []);
  const isolated = samplePost({ slug: "isolado", category: "Única", tags: ["única"] });
  assert.deepEqual(getRelatedNews(isolated, 3, NOW), []);
});

test("events classify automatically by date: upcoming ascending, past most recent first", () => {
  const { upcoming, past } = classifyEvents(Date.now());
  assert.equal(upcoming.length, 2, "two upcoming sample events");
  assert.equal(past.length, 1, "one past sample event");
  assert.ok(eventPosts.some((event) => event.status === "draft"), "sample content includes a draft event");
  assert.ok(!upcoming.concat(past).some((event) => event.status === "draft"), "draft events are excluded");
  for (let index = 1; index < upcoming.length; index += 1) assert.ok(Date.parse(upcoming[index - 1].startsAt) <= Date.parse(upcoming[index].startsAt));
  for (let index = 1; index < past.length; index += 1) assert.ok(Date.parse(past[index - 1].startsAt) >= Date.parse(past[index].startsAt));

  const now = Date.parse("2026-10-06T12:00:00Z");
  const split = classifyEvents(now, [
    sampleEvent({ slug: "a", startsAt: "2026-10-06T12:00:01Z" }),
    sampleEvent({ slug: "b", startsAt: "2026-10-06T12:00:00Z" }),
    sampleEvent({ slug: "c", startsAt: "2026-10-05T12:00:00Z" }),
    sampleEvent({ slug: "d", startsAt: "2026-10-08T12:00:00Z", status: "draft" }),
  ]);
  assert.deepEqual(split.upcoming.map((event) => event.slug), ["a"]);
  assert.deepEqual(split.past.map((event) => event.slug), ["b", "c"], "start time equal to now counts as past");
});

test("announcement only shows inside its active window", () => {
  const now = Date.now();
  const active = getActiveAnnouncement(now);
  if (siteAnnouncement) {
    assert.equal(active?.id, siteAnnouncement.id, "configured sample announcement is active");
  } else {
    assert.equal(active, null);
  }
  const announcement = { id: "aviso", title: "T", message: "M", startsAt: "2026-10-01T00:00:00Z", expiresAt: "2026-10-05T00:00:00Z" };
  assert.equal(getActiveAnnouncement(NOW, announcement), null, "expired window is inactive");
  assert.equal(getActiveAnnouncement(Date.parse("2026-10-03T00:00:00Z"), announcement)?.id, "aviso");
  assert.equal(getActiveAnnouncement(Date.parse("2026-09-30T00:00:00Z"), announcement), null, "before start is inactive");
  assert.equal(getActiveAnnouncement(NOW, null), null, "no announcement means nothing to show");
  const open = { id: "aberto", title: "T", message: "M" };
  assert.equal(getActiveAnnouncement(NOW, open)?.id, "aberto", "missing bounds stay open");
});

test("content date formatting is centralized, timezone-aware and honest about bad input", () => {
  // 18:00 in Brasília (UTC-3).
  assert.equal(formatNewsDate("2026-09-28T18:00:00-03:00"), "28 de setembro de 2026");
  assert.ok(formatNewsShortDate("2026-09-28T18:00:00-03:00").includes("2026"));
  // 01:00 UTC is still the previous day in Brasília.
  assert.equal(formatNewsDate("2026-09-28T01:00:00Z"), "27 de setembro de 2026");
  assert.equal(formatClockTime("2026-10-10T22:00:00Z"), "19:00", "event clock uses Brasília time");
  assert.equal(formatEventRange("2026-10-10T22:00:00Z", "2026-10-11T01:00:00Z"), "10 de out. de 2026 · 19:00–22:00");
  assert.equal(formatEventRange("2026-10-10T22:00:00Z"), "10 de out. de 2026 · 19:00");
  for (const bad of [null, undefined, "", "not-a-date"]) {
    assert.equal(formatNewsDate(bad), "Data indisponível");
    assert.equal(formatEventRange(bad as string), "Data indisponível");
  }
});
