import { z } from "zod";
import { isJavaUsername, isMinecraftUuid } from "@/lib/minecraft-profile";

const counter = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable();
const timestamp = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString()).nullable();

const hasControlChars = (value: string) => [...value].some((char) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
});

const rankSchema = z.string().trim().min(1).max(64).refine((value) => !hasControlChars(value)).nullable();

// All fields are required. Unknown values must be explicit null, never invented defaults.
// z.object strips extra provider fields before anything is exposed publicly.
export const playerStatsSchema = z.object({
  username: z.string().refine(isJavaUsername),
  uuid: z.string().refine(isMinecraftUuid),
  rank: rankSchema,
  coins: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
  playtimeSeconds: counter,
  firstJoin: timestamp,
  lastSeen: timestamp,
  online: z.boolean().nullable(),
  kills: counter,
  deaths: counter,
}).refine((value) => !value.firstJoin || !value.lastSeen || Date.parse(value.firstJoin) <= Date.parse(value.lastSeen));

export type PlayerStats = z.infer<typeof playerStatsSchema>;
export type PlayerStatsResult = { status: "available"; data: PlayerStats } | { status: "invalid" | "not_found" | "unavailable" };

export const LEADERBOARD_CATEGORIES = ["playtime", "kills", "coins"] as const;
export type LeaderboardCategory = (typeof LEADERBOARD_CATEGORIES)[number];
export const leaderboardCategorySchema = z.enum(LEADERBOARD_CATEGORIES);

// Safe maximum the website will ever request or publish; the UI uses the default of 10.
export const MAX_LEADERBOARD_ENTRIES = 50;
export const DEFAULT_LEADERBOARD_ENTRIES = 10;

// A leaderboard entry always carries the number it is ranked by; missing values stay off the board.
export const leaderboardEntrySchema = z.object({
  username: z.string().refine(isJavaUsername),
  uuid: z.string().refine(isMinecraftUuid),
  rank: rankSchema,
  value: z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export const leaderboardEntriesSchema = z.array(leaderboardEntrySchema);
export const leaderboardDataSchema = z.object({ category: leaderboardCategorySchema, entries: leaderboardEntriesSchema });

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type LeaderboardData = z.infer<typeof leaderboardDataSchema>;
export type LeaderboardResult = { status: "available"; data: LeaderboardData } | { status: "invalid" | "unavailable" };

// Safe maximum published by the website; keeps a full payload inside the 16 KiB transport bound.
export const MAX_ONLINE_PLAYERS = 100;

// The online list carries only public presence fields; playtimeSeconds is null when unknown.
export const onlinePlayerSchema = z.object({
  username: z.string().refine(isJavaUsername),
  uuid: z.string().refine(isMinecraftUuid),
  rank: rankSchema,
  playtimeSeconds: counter,
});
export const onlinePlayersSchema = z.array(onlinePlayerSchema);

export type OnlinePlayer = z.infer<typeof onlinePlayerSchema>;
export type OnlinePlayersResult = { status: "available"; data: OnlinePlayer[] } | { status: "unavailable" };
