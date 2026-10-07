import { wikiGuides } from "./guides";
import { WIKI_CATEGORIES, type WikiBlock, type WikiCalloutKind, type WikiCategory, type WikiGuide, type WikiSection } from "./types";

export { wikiGuides, WIKI_CATEGORIES };
export type { WikiGuide, WikiSection, WikiBlock, WikiCategory, WikiCalloutKind };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** A guide is visible unless explicitly marked as draft. */
export function isGuideVisible(guide: WikiGuide): boolean {
  return (guide.status ?? "published") === "published";
}

/** All visible guides, in content order. */
export function getPublishedGuides(guides: readonly WikiGuide[] = wikiGuides): WikiGuide[] {
  return guides.filter((guide) => isGuideVisible(guide));
}

export function getGuideBySlug(slug: string, guides: readonly WikiGuide[] = wikiGuides): WikiGuide | undefined {
  return getPublishedGuides(guides).find((guide) => guide.slug === slug);
}

/** Concatenated text a guide is matched against in listings and global search. */
export function getGuideSearchText(guide: WikiGuide): string {
  const parts: string[] = [guide.title, guide.description, guide.category, ...(guide.tags ?? [])];
  for (const section of guide.sections) {
    parts.push(section.title);
    for (const block of section.blocks) {
      if (block.type === "paragraph" || block.type === "callout") {
        parts.push(block.text);
        if (block.type === "callout" && block.title) parts.push(block.title);
      } else if (block.type === "bullets" || block.type === "steps") {
        parts.push(...block.items);
      } else if (block.type === "command") {
        parts.push(block.command);
        if (block.note) parts.push(block.note);
      } else if (block.type === "table") {
        if (block.caption) parts.push(block.caption);
        parts.push(...block.headers, ...block.rows.flat());
      } else {
        for (const item of block.items) {
          parts.push(item.label);
          if (item.description) parts.push(item.description);
        }
      }
    }
  }
  return parts.join(" ");
}

export type WikiGuideFilter = { query?: string; category?: string };

/** Word-AND search (accent-insensitive) combined with an optional category filter. */
export function filterWikiGuides(guides: readonly WikiGuide[], { query = "", category = "Todas" }: WikiGuideFilter = {}): WikiGuide[] {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return guides.filter((guide) => {
    if (category !== "Todas" && guide.category !== category) return false;
    if (!words.length) return true;
    const haystack = normalize(getGuideSearchText(guide));
    return words.every((word) => haystack.includes(word));
  });
}

/** Visible guides flagged as featured, capped at `limit`. */
export function getFeaturedGuides(limit = 3, guides: readonly WikiGuide[] = wikiGuides): WikiGuide[] {
  return getPublishedGuides(guides).filter((guide) => guide.featured).slice(0, Math.max(0, limit));
}

/** Related guides: resolved `related` slugs first, then same-category fill-ups. */
export function getRelatedGuides(guide: WikiGuide, limit = 3, guides: readonly WikiGuide[] = wikiGuides): WikiGuide[] {
  const visible = getPublishedGuides(guides);
  const related: WikiGuide[] = [];
  for (const slug of guide.related ?? []) {
    const match = visible.find((candidate) => candidate.slug === slug);
    if (match && match.slug !== guide.slug && !related.some((item) => item.slug === match.slug)) related.push(match);
  }
  if (related.length < limit) {
    for (const candidate of visible) {
      if (related.length >= limit) break;
      if (candidate.slug === guide.slug || candidate.category !== guide.category) continue;
      if (!related.some((item) => item.slug === candidate.slug)) related.push(candidate);
    }
  }
  return related.slice(0, Math.max(0, limit));
}

/** Previous/next published guide within the same category, or undefined at the edges. */
export function getAdjacentGuides(slug: string, guides: readonly WikiGuide[] = wikiGuides): { previous?: WikiGuide; next?: WikiGuide } {
  const visible = getPublishedGuides(guides);
  const index = visible.findIndex((guide) => guide.slug === slug);
  if (index === -1) return {};
  const category = visible[index].category;
  let previous: WikiGuide | undefined;
  let next: WikiGuide | undefined;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (visible[cursor].category === category) { previous = visible[cursor]; break; }
  }
  for (let cursor = index + 1; cursor < visible.length; cursor += 1) {
    if (visible[cursor].category === category) { next = visible[cursor]; break; }
  }
  return { previous, next };
}

/** Visible guides per canonical category, in WIKI_CATEGORIES order. */
export function getWikiCategoryCounts(guides: readonly WikiGuide[] = wikiGuides): { category: WikiCategory; count: number }[] {
  const visible = getPublishedGuides(guides);
  return WIKI_CATEGORIES.map((category) => ({ category, count: visible.filter((guide) => guide.category === category).length }));
}
