import { isJavaUsername } from "./minecraft-profile";

export const RECENT_PLAYERS_KEY = "swift-mc-recent-players";
export const MAX_RECENT_PLAYERS = 8;

export function parseRecentPlayers(value: string | null): string[] {
  if (!value || value.length > 4096) return [];
  try {
    const data: unknown = JSON.parse(value);
    if (!Array.isArray(data)) return [];
    const names: string[] = [];
    for (const name of data) {
      if (typeof name === "string" && isJavaUsername(name) && !names.some((item) => item.toLowerCase() === name.toLowerCase())) names.push(name);
      if (names.length === MAX_RECENT_PLAYERS) break;
    }
    return names;
  } catch { return []; }
}

export function addRecentPlayer(current: readonly string[], username: string): string[] {
  if (!isJavaUsername(username)) return [...current];
  return parseRecentPlayers(JSON.stringify([username, ...current.filter((name) => name.toLowerCase() !== username.toLowerCase())].slice(0, MAX_RECENT_PLAYERS)));
}
