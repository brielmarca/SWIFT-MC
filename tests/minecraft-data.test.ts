import assert from "node:assert/strict";
import test from "node:test";
import { getMinecraftDataConfig, fetchMinecraftData } from "@/lib/minecraft-data/client";
import { createPlayerStatsService } from "@/lib/minecraft-data/player-stats";
import { playerStatsSchema } from "@/lib/minecraft-data/types";
import { formatPlaytime, formatPlayerTimestamp, formatPlayerNumber } from "@/lib/player-format";

const config = { baseUrl: "https://data.example.com/v1/", token: "secret-token" };

test("config requires URL and token; rejects unsafe URLs and never logs token", () => {
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "", MINECRAFT_DATA_API_TOKEN: "t" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://data.example.com", MINECRAFT_DATA_API_TOKEN: "" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "ftp://data.example.com", MINECRAFT_DATA_API_TOKEN: "t" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://user:pass@data.example.com", MINECRAFT_DATA_API_TOKEN: "t" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://data.example.com/?q=1", MINECRAFT_DATA_API_TOKEN: "t" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://data.example.com#frag", MINECRAFT_DATA_API_TOKEN: "t" }), null);
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://data.example.com", MINECRAFT_DATA_API_TOKEN: "t\nx" }), null);
  const ok = getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "https://data.example.com/v1", MINECRAFT_DATA_API_TOKEN: "t" });
  assert.equal(ok?.baseUrl, "https://data.example.com/v1/");
  // Production must not accept plain-HTTP private APIs.
  assert.equal(getMinecraftDataConfig({ MINECRAFT_DATA_API_URL: "http://127.0.0.1:8080", MINECRAFT_DATA_API_TOKEN: "t", NODE_ENV: "production" }), null);
});

test("transport validates path segments and sends only server credentials", async () => {
  const calls: Array<{ url: string; auth: string | null; redirect: RequestRedirect | undefined }> = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers = init?.headers;
    const auth = headers instanceof Headers ? headers.get("Authorization") : typeof headers === "object" && headers ? (headers as Record<string, string>).Authorization ?? null : null;
    calls.push({ url, auth, redirect: init?.redirect });
    return Response.json({ ok: true });
  };
  const ok = await fetchMinecraftData(config, ["players", "abc-123", "stats"], fetcher);
  assert.equal(ok.status, "ok");
  assert.equal(calls[0].url, "https://data.example.com/v1/players/abc-123/stats");
  assert.equal(calls[0].auth, "Bearer secret-token");
  assert.equal(calls[0].redirect, "error");
  for (const bad of [[], [".."], ["../etc"], ["a/b"], ["a b"]]) {
    assert.deepEqual(await fetchMinecraftData(config, bad as string[], fetcher), { status: "unavailable" });
  }
  assert.equal(calls.length, 1);
});

test("transport normalizes not-found, non-JSON, errors and timeouts without exposing bodies", async () => {
  for (const response of [new Response(null, { status: 404 }), new Response(null, { status: 204 })]) {
    assert.deepEqual(await fetchMinecraftData(config, ["p"], async () => response), { status: "not_found" });
  }
  for (const response of [
    new Response("secret detail", { status: 500 }),
    new Response("{}", { headers: { "Content-Type": "text/plain" } }),
    new Response("{broken", { headers: { "Content-Type": "application/json" } }),
    new Response("x".repeat(17000), { headers: { "Content-Type": "application/json" } }),
  ]) {
    assert.deepEqual(await fetchMinecraftData(config, ["p"], async () => response), { status: "unavailable" });
  }
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await fetchMinecraftData(config, ["p"], async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("Timeout")), { once: true });
    }), 10);
    assert.deepEqual(result, { status: "unavailable" });
  } finally { clearTimeout(keepAlive); }
});

const validStats = {
  username: "Steve", uuid: "01234567-89ab-cdef-0123-456789abcdef", rank: "VIP", coins: 1500.5,
  playtimeSeconds: 3661, firstJoin: "2024-01-01T00:00:00Z", lastSeen: "2025-06-01T12:00:00+00:00",
  online: true, kills: 12, deaths: 3,
};

test("stats schema accepts normalized data and strips unknown provider fields", () => {
  const parsed = playerStatsSchema.parse({ ...validStats, secretInternalField: "never-exposed", extra: { nested: true } });
  assert.equal("secretInternalField" in parsed, false);
  assert.equal("extra" in parsed, false);
  assert.equal(parsed.username, "Steve");
  assert.equal(parsed.firstJoin, "2024-01-01T00:00:00.000Z");
  // Explicit nulls are honest unknowns, not errors.
  const unknowns = playerStatsSchema.parse({ ...validStats, rank: null, coins: null, playtimeSeconds: null, firstJoin: null, lastSeen: null, online: null, kills: null, deaths: null });
  assert.deepEqual(
    [unknowns.rank, unknowns.coins, unknowns.playtimeSeconds, unknowns.firstJoin, unknowns.lastSeen, unknowns.online, unknowns.kills, unknowns.deaths],
    [null, null, null, null, null, null, null, null],
  );
});

test("stats schema rejects malformed, negative, oversized and inconsistent data", () => {
  const invalidCases: Array<Record<string, unknown>> = [
    { ...validStats, uuid: "../../etc" },
    { ...validStats, uuid: "0123456789abcdef0123456789abcdef" },
    { ...validStats, username: "bad/name" },
    { ...validStats, username: "x" },
    { ...validStats, rank: "" },
    { ...validStats, rank: "x".repeat(65) },
    { ...validStats, rank: "line\nbreak" },
    { ...validStats, coins: -1 },
    { ...validStats, coins: Number.NaN },
    { ...validStats, playtimeSeconds: -1 },
    { ...validStats, playtimeSeconds: 1.5 },
    { ...validStats, kills: 1e22 },
    { ...validStats, online: "true" },
    { ...validStats, firstJoin: "not-a-date" },
    { ...validStats, firstJoin: 1700000000 },
    { ...validStats, lastSeen: "2023-01-01T00:00:00Z" },
    { ...validStats, online: 1 },
  ];
  for (const value of invalidCases) assert.equal(playerStatsSchema.safeParse(value).success, false, JSON.stringify(Object.keys(value)));
});

test("service is unavailable without configuration and does not call providers", async () => {
  let profileCalls = 0;
  let transportCalls = 0;
  const service = createPlayerStatsService({
    getConfig: () => null,
    lookupProfile: async () => { profileCalls++; return { status: "invalid" }; },
    transport: async () => { transportCalls++; return { status: "unavailable" }; },
  });
  assert.deepEqual(await service.getByUsername("Steve"), { status: "unavailable" });
  assert.equal(profileCalls, 0);
  assert.equal(transportCalls, 0);
});

test("service validates username, resolves canonical profile and normalizes provider data", async () => {
  const transportUrls: string[][] = [];
  const service = createPlayerStatsService({
    getConfig: () => config,
    lookupProfile: async (username) => {
      assert.equal(username, "steve");
      return { status: "found", profile: { username: "Steve", uuid: validStats.uuid, avatarUrl: "/api/minecraft/avatar/x" } };
    },
    transport: async (_config, segments) => { transportUrls.push([...segments]); return { status: "ok", body: { ...validStats, leaked: "token" } }; },
  });
  const result = await service.getByUsername("steve");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.data.username, "Steve");
  assert.equal(result.data.rank, "VIP");
  assert.equal("leaked" in result.data, false);
  assert.deepEqual(transportUrls, [["players", validStats.uuid, "stats"]]);
  assert.deepEqual(await service.getByUsername("../bad"), { status: "invalid" });
});

test("service maps provider not-found, mismatched identity and invalid payload safely", async () => {
  const notFound = createPlayerStatsService({
    getConfig: () => config,
    lookupProfile: async () => ({ status: "found", profile: { username: "Steve", uuid: validStats.uuid, avatarUrl: "" } }),
    transport: async () => ({ status: "not_found" }),
  });
  assert.deepEqual(await notFound.getByUsername("Steve"), { status: "not_found" });

  for (const body of [
    { ...validStats, uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" },
    { ...validStats, username: "Alex" },
    { ...validStats, coins: -50 },
  ]) {
    const service = createPlayerStatsService({
      getConfig: () => config,
      lookupProfile: async () => ({ status: "found", profile: { username: "Steve", uuid: validStats.uuid, avatarUrl: "" } }),
      transport: async () => ({ status: "ok", body }),
    });
    assert.deepEqual(await service.getByUsername("Steve"), { status: "unavailable" });
  }
});

test("service caches results briefly, shares concurrent work and bounds memory", async () => {
  let time = 0;
  let calls = 0;
  const service = createPlayerStatsService({
    getConfig: () => config,
    lookupProfile: async () => ({ status: "found", profile: { username: "Steve", uuid: validStats.uuid, avatarUrl: "" } }),
    transport: async () => { calls++; return { status: "ok", body: validStats }; },
    now: () => time,
  });
  await Promise.all([service.getByUsername("Steve"), service.getByUsername("steve"), service.getByUsername("STEVE")]);
  await service.getByUsername("Steve");
  assert.equal(calls, 1);
  time = 15001;
  await service.getByUsername("Steve");
  assert.equal(calls, 2);
  // Identity changes must not reuse another player's cached stats.
  const other = createPlayerStatsService({
    getConfig: () => config,
    lookupProfile: async (username) => username === "Alex"
      ? { status: "found", profile: { username: "Alex", uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", avatarUrl: "" } }
      : { status: "found", profile: { username: "Steve", uuid: validStats.uuid, avatarUrl: "" } },
    transport: async (_config, segments) => segments[1] === validStats.uuid
      ? { status: "ok", body: validStats }
      : { status: "ok", body: { ...validStats, username: "Alex", uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" } },
    now: () => time,
  });
  await Promise.all([other.getByUsername("Steve"), other.getByUsername("Alex")]);
  assert.equal(calls, 2);
});

test("formatting helpers produce honest human values", () => {
  assert.equal(formatPlaytime(0), "0 s");
  assert.equal(formatPlaytime(45), "45 s");
  assert.equal(formatPlaytime(60), "1 min");
  assert.equal(formatPlaytime(3661), "1 h 1 min");
  assert.equal(formatPlaytime(90000), "1 d 1 h");
  assert.equal(formatPlaytime(90061), "1 d 1 h 1 min");
  for (const value of [null, undefined, -1, 1.5, Number.NaN, Number.MAX_VALUE + 2]) assert.equal(formatPlaytime(value), "Indisponível");

  assert.equal(formatPlayerNumber(null), "Indisponível");
  assert.equal(formatPlayerNumber(-1), "Indisponível");
  assert.equal(formatPlayerNumber(0), "0");
  assert.equal(formatPlayerNumber(1500.5), "1.500,5");
  assert.equal(formatPlayerNumber(1234567), "1.234.567");

  assert.equal(formatPlayerTimestamp(null), "Indisponível");
  assert.equal(formatPlayerTimestamp("invalid"), "Indisponível");
  assert.equal(formatPlayerTimestamp("2024-01-01T00:00:00Z"), "1 de jan. de 2024, 00:00 UTC");
  assert.equal(formatPlayerTimestamp("2025-06-01T12:00:00+00:00"), "1 de jun. de 2025, 12:00 UTC");
});
