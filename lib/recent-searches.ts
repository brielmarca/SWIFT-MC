// Local recent-search history for the global search palette.
// Browser storage only — no analytics, no server persistence.

export const RECENT_SEARCHES_KEY = "swift-mc-recent-searches";
export const RECENT_SEARCHES_EVENT = "swift-mc-recent-searches-change";
export const MAX_RECENT_SEARCHES = 8;
const MAX_QUERY_LENGTH = 64;

export function parseRecentSearches(value: string | null): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const data: unknown = JSON.parse(value);
    if (!Array.isArray(data)) return [];
    const items: string[] = [];
    for (const entry of data) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim().slice(0, MAX_QUERY_LENGTH);
      if (!trimmed) continue;
      if (items.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue;
      items.push(trimmed);
      if (items.length === MAX_RECENT_SEARCHES) break;
    }
    return items;
  } catch { return []; }
}

export function addRecentSearch(current: readonly string[], query: string): string[] {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (!trimmed) return parseRecentSearches(JSON.stringify(current));
  return parseRecentSearches(JSON.stringify([trimmed, ...current.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())]));
}

export function subscribeRecentSearches(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECENT_SEARCHES_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(RECENT_SEARCHES_EVENT, callback);
  };
}

export function getRecentSearchesSnapshot(): string {
  try { return window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]"; }
  catch { return "[]"; }
}

export function getRecentSearchesServerSnapshot(): string {
  return "[]";
}

export function saveRecentSearch(query: string): boolean {
  try {
    const next = addRecentSearch(parseRecentSearches(getRecentSearchesSnapshot()), query);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
    return true;
  } catch { return false; }
}

export function clearRecentSearches(): boolean {
  try {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    window.dispatchEvent(new Event(RECENT_SEARCHES_EVENT));
    return true;
  } catch { return false; }
}
