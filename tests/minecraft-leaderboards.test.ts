import assert from "node:assert/strict";
import test from "node:test";
import { fetchMinecraftData } from "@/lib/minecraft-data/client";
import { createLeaderboardService, isValidLeaderboardLimit, parseLeaderboardQuery } from "@/lib/minecraft-data/leaderboards";
import {
  DEFAULT_LEADERBOARD_ENTRIES,
  LEADERBOARD_CATEGORIES,
  MAX_LEADERBOARD_ENTRIES,
  leaderboardDataSchema,
  leaderboardEntriesSchema,
} from "@/lib/minecraft-data/types";

const config = { baseUrl: "https://data.example.com/v1/", token: "secret-token" };
const entry = (username: string, uuid: string, value: number, rank: string | null = null) => ({ username, uuid, rank, value });
const entries = [
  entry("Steve", "01234567-89ab-cdef-0123-456789abcdef", 900, "MVP"),
  entry("Alex", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", 500),
  entry("Notch", "11111111-2222-3333-4444-555555555555", 120, "VIP"),
];

test("leaderboard query validates category and clamps to the safe limit range", () => {
  assert.deepEqual(parseLeaderboardQuery(new URLSearchParams("category=playtime")), { status: "ok", category: "playtime", limit: DEFAULT_LEADERBOARD_ENTRIES });
  assert.deepEqual(parseLeaderboardQuery(new URLSearchParams("category=coins&limit=25")), { status: "ok", category: "coins", limit: 25 });
  for (const query of ["", "category=nope", "category=playtime&limit=", "category=playtime&limit=0", `category=playtime&limit=${MAX_LEADERBOARD_ENTRIES + 1}`, "category=playtime&limit=1.5", "category=playtime&limit=abc", "category=playtime&limit=-5", "category[]=playtime", "limit=10"]) {
    assert.deepEqual(parseLeaderboardQuery(new URLSearchParams(query)), { status: "invalid" }, query);
  }
  assert.ok(isValidLeaderboardLimit(1) && isValidLeaderboardLimit(MAX_LEADERBOARD_ENTRIES));
  assert.ok(!isValidLeaderboardLimit(0) && !isValidLeaderboardLimit(MAX_LEADERBOARD_ENTRIES + 1) && !isValidLeaderboardLimit(1.5));
  assert.deepEqual([...LEADERBOARD_CATEGORIES], ["playtime", "kills", "coins"]);
});

test("transport appends validated query strings and never fetches unsafe ones", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    calls.push(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    return Response.json([]);
  };
  await fetchMinecraftData(config, ["leaderboards", "playtime"], fetcher, 4000, { limit: "10" });
  assert.equal(calls[0], "https://data.example.com/v1/leaderboards/playtime?limit=10");
  for (const query of [{ "bad key": "1" }, { limit: "10 20" }, { limit: "../../etc" }, Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, "v"]))]) {
    assert.deepEqual(await fetchMinecraftData(config, ["leaderboards", "playtime"], fetcher, 4000, query), { status: "unavailable" });
  }
  assert.equal(calls.length, 1);
});

test("service rejects invalid category and limit before touching configuration", async () => {
  let configCalls = 0;
  let transportCalls = 0;
  const service = createLeaderboardService({
    getConfig: () => { configCalls++; return config; },
    transport: async () => { transportCalls++; return { status: "ok", body: [] }; },
  });
  assert.deepEqual(await service.get("xp", 10), { status: "invalid" });
  assert.deepEqual(await service.get("playtime", 0), { status: "invalid" });
  assert.deepEqual(await service.get("kills", MAX_LEADERBOARD_ENTRIES + 1), { status: "invalid" });
  assert.equal(configCalls, 0);
  assert.equal(transportCalls, 0);
});

test("service is unavailable without configuration and never calls the provider", async () => {
  let transportCalls = 0;
  const service = createLeaderboardService({ getConfig: () => null, transport: async () => { transportCalls++; return { status: "ok", body: [] }; } });
  assert.deepEqual(await service.get("playtime", 10), { status: "unavailable" });
  assert.equal(transportCalls, 0);
});

test("service requests the provider board, normalizes and limits entries", async () => {
  const seen: { segments: readonly string[]; query?: Readonly<Record<string, string>> }[] = [];
  const service = createLeaderboardService({
    getConfig: () => config,
    transport: async (_config, segments, _fetcher, _timeout, query) => {
      seen.push({ segments, query });
      return { status: "ok", body: [...entries, { username: "Herobrine", uuid: "99999999-8888-7777-6666-555555555555", rank: null, value: 10, internalScore: 999 }] };
    },
  });
  const result = await service.get("playtime", 3);
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.data.category, "playtime");
  assert.equal(result.data.entries.length, 3, "slices to the requested limit");
  assert.deepEqual(result.data.entries[0], { username: "Steve", uuid: "01234567-89ab-cdef-0123-456789abcdef", rank: "MVP", value: 900 });
  assert.deepEqual(seen[0], { segments: ["leaderboards", "playtime"], query: { limit: "3" } });

  const full = await service.get("playtime", 10);
  assert.equal(full.status, "available");
  if (full.status !== "available") return;
  assert.equal(full.data.entries.length, 4, "keeps every validated entry within the limit");
  assert.equal("internalScore" in full.data.entries[3], false, "strips unknown provider fields");
  assert.deepEqual(seen[1], { segments: ["leaderboards", "playtime"], query: { limit: "10" } });
  // The private token never reaches the public result.
  assert.equal(JSON.stringify(result).includes(config.token), false);
});

test("service publishes an empty board as an honest empty list", async () => {
  const service = createLeaderboardService({ getConfig: () => config, transport: async () => ({ status: "ok", body: [] }) });
  const result = await service.get("coins", 10);
  assert.deepEqual(result, { status: "available", data: { category: "coins", entries: [] } });
});

test("service rejects malformed provider payloads without fabricating entries", async () => {
  const bodies: unknown[] = [
    { entries },
    "nope",
    null,
    [...Array.from({ length: 201 }, (_, i) => entry(`Player${i}`, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, 9999 - i))],
    [entry("Bad", "not-a-uuid", 10)],
    [entry("Bad", "01234567-89ab-cdef-0123-456789abcdef", -5)],
    [entry("Bad", "01234567-89ab-cdef-0123-456789abcdef", Number.NaN)],
    [entry("Steve", "01234567-89ab-cdef-0123-456789abcdef", 900), entry("Alex", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", 1000)],
    [entry("Steve", "01234567-89ab-cdef-0123-456789abcdef", 900), entry("Alex", "01234567-89ab-cdef-0123-456789abcdef", 100)],
  ];
  for (const body of bodies) {
    const service = createLeaderboardService({ getConfig: () => config, transport: async () => ({ status: "ok", body }) });
    assert.deepEqual(await service.get("playtime", 10), { status: "unavailable" });
  }
});

test("service enforces integer values for playtime and kills but allows decimal coins", async () => {
  for (const category of ["playtime", "kills"] as const) {
    const service = createLeaderboardService({ getConfig: () => config, transport: async () => ({ status: "ok", body: [entry("Steve", "01234567-89ab-cdef-0123-456789abcdef", 10.5)] }) });
    assert.deepEqual(await service.get(category, 10), { status: "unavailable" }, category);
  }
  const coins = createLeaderboardService({ getConfig: () => config, transport: async () => ({ status: "ok", body: [entry("Steve", "01234567-89ab-cdef-0123-456789abcdef", 10.5)] }) });
  const result = await coins.get("coins", 10);
  assert.equal(result.status, "available");
});

test("service maps a missing provider board to unavailable, not to an empty board", async () => {
  for (const status of ["not_found", "unavailable"] as const) {
    const service = createLeaderboardService({ getConfig: () => config, transport: async () => ({ status }) });
    assert.deepEqual(await service.get("kills", 10), { status: "unavailable" });
  }
});

test("service caches boards briefly and coalesces concurrent requests", async () => {
  let time = 0;
  let calls = 0;
  const service = createLeaderboardService({
    getConfig: () => config,
    transport: async () => { calls++; return { status: "ok", body: entries }; },
    now: () => time,
  });
  await Promise.all([service.get("playtime", 10), service.get("playtime", 10), service.get("playtime", 10)]);
  await service.get("playtime", 10);
  assert.equal(calls, 1);
  await service.get("kills", 10);
  assert.equal(calls, 2, "categories are cached independently");
  time = 15001;
  await service.get("playtime", 10);
  assert.equal(calls, 3);
  const otherLimit = createLeaderboardService({
    getConfig: () => config,
    transport: async () => { calls++; return { status: "ok", body: entries }; },
    now: () => time,
  });
  await Promise.all([otherLimit.get("coins", 5), otherLimit.get("coins", 10)]);
  assert.equal(calls, 5, "limits are cached independently");
});

test("shared schemas validate leaderboard payloads and strip unknown fields", () => {
  const parsed = leaderboardDataSchema.parse({ category: "coins", entries: [{ ...entries[0], providerOnly: true }] });
  assert.equal("providerOnly" in parsed.entries[0], false);
  assert.equal(leaderboardEntriesSchema.safeParse(entries).success, true);
  assert.equal(leaderboardDataSchema.safeParse({ category: "xp", entries }).success, false);
  assert.equal(leaderboardEntriesSchema.safeParse([{ ...entries[0], value: null }]).success, false);
  assert.equal(leaderboardEntriesSchema.safeParse([{ ...entries[0], rank: "" }]).success, false);
});
