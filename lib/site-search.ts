import { classifyEvents, getPublishedNews } from "@/data/content";
import { formatNewsShortDate } from "@/lib/content-format";
import { isJavaUsername } from "@/lib/minecraft-profile";
import { playerLinks } from "@/data/server-info";
import { faqs, rules } from "@/data/player-guides";
import { getGuideSearchText, getPublishedGuides } from "@/data/wiki";

// Pure, client-side site search over the existing typed data sources.
// No data is duplicated here — sources are imported from their own modules.

export const SEARCH_GROUPS = [
  { id: "jogador", label: "Jogador" },
  { id: "noticias", label: "Notícias" },
  { id: "eventos", label: "Eventos" },
  { id: "wiki", label: "Wiki" },
  { id: "regras", label: "Regras" },
  { id: "faq", label: "FAQ" },
  { id: "paginas", label: "Páginas" },
] as const;

export type SearchGroupId = (typeof SEARCH_GROUPS)[number]["id"];

export type SearchResult = {
  id: string;
  group: SearchGroupId;
  title: string;
  snippet?: string;
  href: string;
  meta?: string;
};

export type SearchGroup = { id: SearchGroupId; label: string; items: SearchResult[] };

/** Hard cap per group so the palette stays compact. */
export const MAX_RESULTS_PER_GROUP: Record<SearchGroupId, number> = {
  jogador: 1,
  noticias: 4,
  eventos: 3,
  wiki: 4,
  regras: 4,
  faq: 4,
  paginas: 5,
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function getSearchWords(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean);
}

type Candidate = { key: string; title: string; extra: string; snippet?: string; href: string; meta?: string };

function scoreCandidate(candidate: Candidate, query: string, words: readonly string[]): number | null {
  const title = normalize(candidate.title);
  const extra = normalize(candidate.extra);
  if (!words.every((word) => title.includes(word) || extra.includes(word))) return null;
  const normalizedQuery = normalize(query.trim());
  let score = 1;
  if (title === normalizedQuery) score += 8;
  else if (title.startsWith(normalizedQuery)) score += 5;
  else if (title.includes(normalizedQuery)) score += 3;
  if (words.every((word) => title.includes(word))) score += 2;
  return score;
}

function rankCandidates(group: SearchGroupId, label: string, candidates: readonly Candidate[], query: string, words: readonly string[]): SearchGroup | null {
  const matches = candidates
    .map((candidate, index) => ({ candidate, index, score: scoreCandidate(candidate, query, words) }))
    .filter((entry): entry is { candidate: Candidate; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_RESULTS_PER_GROUP[group])
    .map(({ candidate }) => ({
      id: `${group}:${candidate.key}`,
      group,
      title: candidate.title,
      snippet: candidate.snippet,
      href: candidate.href,
      meta: candidate.meta,
    }));
  if (!matches.length) return null;
  return { id: group, label, items: matches };
}

const PAGE_DESCRIPTIONS: Record<string, string> = {
  "/store": "Loja de ranks VIP, benefícios e carrinho local",
  "/play": "Endereço do servidor, versão e como entrar",
  "/online": "Jogadores online agora no SWIFT MC",
  "/player": "Perfil público e estatísticas de jogadores",
  "/leaderboards": "Ranking de tempo de jogo, abates e moedas",
  "/news": "Notícias, guias e avisos da comunidade",
  "/events": "Próximos eventos e atividades da comunidade",
  "/wiki": "Guias completos do servidor em passo a passo",
  "/rules": "Regras do servidor e convivência",
  "/faq": "Perguntas frequentes sobre o servidor",
  "/status": "Status e versão atual do servidor",
};

/** Search across all local sources. Draft/future news, draft events are excluded via the existing queries. */
export function searchSite(query: string, now: number = Date.now()): SearchGroup[] {
  const words = getSearchWords(query);
  if (!words.length) return [];
  const groups: (SearchGroup | null)[] = [];

  const name = query.trim();
  groups.push(isJavaUsername(name) ? {
    id: "jogador",
    label: "Jogador",
    items: [{ id: "jogador:perfil", group: "jogador", title: `Buscar jogador: ${name}`, href: `/player/${name}`, meta: "Perfil público" }],
  } : null);

  groups.push(rankCandidates("noticias", "Notícias", getPublishedNews(now).map((post) => ({
    key: post.slug,
    title: post.title,
    extra: `${post.excerpt} ${post.category} ${post.tags.join(" ")}`,
    snippet: snippet(post.excerpt, query),
    href: `/news/${post.slug}`,
    meta: formatNewsShortDate(post.publishedAt),
  })), query, words));

  const { upcoming, past } = classifyEvents(now);
  groups.push(rankCandidates("eventos", "Eventos", [...upcoming, ...past].map((event) => ({
    key: event.slug,
    title: event.title,
    extra: `${event.description} ${event.location ?? ""} ${event.mode ?? ""}`,
    snippet: snippet(event.description, query),
    href: "/events",
    meta: formatNewsShortDate(event.startsAt),
  })), query, words));

  groups.push(rankCandidates("wiki", "Wiki", getPublishedGuides().map((guide) => ({
    key: guide.slug,
    title: guide.title,
    extra: getGuideSearchText(guide),
    snippet: snippet(guide.description, query),
    href: `/wiki/${guide.slug}`,
    meta: guide.category,
  })), query, words));

  groups.push(rankCandidates("regras", "Regras", rules.map((rule) => ({
    key: rule.id,
    title: rule.title,
    extra: `${rule.id} ${rule.body} ${rule.category}`,
    snippet: snippet(rule.body, query),
    href: `/rules#${rule.id}`,
    meta: rule.id,
  })), query, words));

  groups.push(rankCandidates("faq", "FAQ", faqs.map((entry) => ({
    key: entry.id,
    title: entry.title,
    extra: `${entry.id} ${entry.body} ${entry.category}`,
    snippet: snippet(entry.body, query),
    href: `/faq#${entry.id}`,
    meta: entry.category,
  })), query, words));

  const pages = playerLinks.map((link) => ({ href: link.href, label: link.label }));
  groups.push(rankCandidates("paginas", "Páginas", [{ href: "/store", label: "Loja" }, ...pages].map((page) => ({
    key: page.href,
    title: page.label,
    extra: `${page.label} ${PAGE_DESCRIPTIONS[page.href] ?? ""} ${page.href}`,
    snippet: PAGE_DESCRIPTIONS[page.href],
    href: page.href,
    meta: page.href,
  })), query, words));

  const labels = Object.fromEntries(SEARCH_GROUPS.map((group) => [group.id, group.label]));
  return groups.filter((group): group is SearchGroup => group !== null).map((group) => ({ ...group, label: labels[group.id] }));
}

type Range = [number, number];

/** Accent- and case-insensitive match ranges (UTF-16 indexes) for highlighting. */
export function findMatchRanges(text: string, query: string): Range[] {
  const words = getSearchWords(query);
  if (!words.length || !text) return [];

  const normalized: string[] = [];
  const map: number[] = [];
  let originalIndex = 0;
  for (const originalChar of text) {
    for (const char of originalChar.normalize("NFD").toLowerCase()) {
      if (/\p{Mark}/u.test(char)) continue;
      normalized.push(char);
      map.push(originalIndex);
    }
    originalIndex += originalChar.length;
  }
  const haystack = normalized.join("");
  if (!haystack) return [];

  const ranges: Range[] = [];
  for (const word of words) {
    let from = 0;
    while (from <= haystack.length - word.length) {
      const found = haystack.indexOf(word, from);
      if (found === -1) break;
      const start = map[found];
      const end = found + word.length < map.length ? map[found + word.length] : text.length;
      ranges.push([start, Math.max(start + 1, end)]);
      from = found + word.length;
    }
  }
  if (!ranges.length) return [];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Range[] = [ranges[0]];
  for (const range of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push(range);
  }
  return merged;
}

/** Trim a long snippet around the first match so the result stays compact. */
export function snippetAround(text: string, ranges: readonly Range[], maxLength = 120): string {
  if (text.length <= maxLength) return text;
  const first = ranges[0];
  const start = Math.max(0, Math.min(first ? first[0] - 30 : 0, text.length - maxLength));
  const end = start + maxLength;
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function snippet(text: string, query: string): string {
  return snippetAround(text, findMatchRanges(text, query));
}
