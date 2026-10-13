import "server-only";
import { fetchMinecraftData, getMinecraftDataConfig } from "./client";
import {
  DEFAULT_LEADERBOARD_ENTRIES,
  LEADERBOARD_CATEGORIES,
  MAX_LEADERBOARD_ENTRIES,
  leaderboardCategorySchema,
  leaderboardEntriesSchema,
  type LeaderboardCategory,
  type LeaderboardResult,
} from "./types";

type Dependencies = {
  getConfig?: typeof getMinecraftDataConfig;
  transport?: typeof fetchMinecraftData;
  now?: () => number;
};

// Defensive cap above MAX_LEADERBOARD_ENTRIES; the byte bound also limits the payload.
const MAX_UPSTREAM_ENTRIES = 200;

export function isValidLeaderboardLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit >= 1 && limit <= MAX_LEADERBOARD_ENTRIES;
}

export function parseLeaderboardQuery(searchParams: URLSearchParams): { status: "ok"; category: LeaderboardCategory; limit: number } | { status: "invalid" } {
  const category = leaderboardCategorySchema.safeParse(searchParams.get("category"));
  if (!category.success) return { status: "invalid" };
  const rawLimit = searchParams.get("limit");
  if (rawLimit === null) return { status: "ok", category: category.data, limit: DEFAULT_LEADERBOARD_ENTRIES };
  if (!/^\d{1,3}$/.test(rawLimit)) return { status: "invalid" };
  const limit = Number(rawLimit);
  if (!isValidLeaderboardLimit(limit)) return { status: "invalid" };
  return { status: "ok", category: category.data, limit };
}

export function createLeaderboardService({ getConfig = getMinecraftDataConfig, transport = fetchMinecraftData, now = Date.now }: Dependencies = {}) {
  const cache = new Map<string, { expires: number; result: LeaderboardResult }>();
  const pending = new Map<string, Promise<LeaderboardResult>>();

  async function get(categoryInput: string, limit: number): Promise<LeaderboardResult> {
    const category = leaderboardCategorySchema.safeParse(categoryInput);
    if (!category.success || !isValidLeaderboardLimit(limit)) return { status: "invalid" };
    const config = getConfig();
    if (!config) return { status: "unavailable" };
    const key = `${category.data}:${limit}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.result;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 10) return { status: "unavailable" };

    const task = (async (): Promise<LeaderboardResult> => {
      const response = await transport(config, ["leaderboards", category.data], undefined, undefined, { limit: String(limit) });
      // A missing board path means the provider integration is incomplete, not an empty board.
      if (response.status !== "ok") return { status: "unavailable" };
      if (!Array.isArray(response.body) || response.body.length > MAX_UPSTREAM_ENTRIES) return { status: "unavailable" };
      const parsed = leaderboardEntriesSchema.safeParse(response.body);
      if (!parsed.success) return { status: "unavailable" };
      const entries = parsed.data;
      const needsInteger = category.data !== "coins";
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (needsInteger && !Number.isInteger(entry.value)) return { status: "unavailable" };
        // Provider must rank descending and never repeat a player.
        if (index > 0 && (entries[index - 1].value < entry.value || entries[index - 1].uuid === entry.uuid)) return { status: "unavailable" };
      }
      return { status: "available", data: { category: category.data, entries: entries.slice(0, limit) } };
    })().catch((): LeaderboardResult => ({ status: "unavailable" })).then((result) => {
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: now() + 15000 });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }

  return { get, categories: LEADERBOARD_CATEGORIES };
}

export const leaderboardService = createLeaderboardService();
