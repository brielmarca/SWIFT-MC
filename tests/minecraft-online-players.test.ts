import assert from "node:assert/strict";
import test from "node:test";
import { createOnlinePlayersService } from "@/lib/minecraft-data/online-players";
import { MAX_ONLINE_PLAYERS, onlinePlayersSchema } from "@/lib/minecraft-data/types";

const config = { baseUrl: "https://data.example.com/v1/", token: "secret-token" };
const makeEntry = (index: number) => ({
  username: `Player${index}`,
  uuid: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  rank: index % 2 === 0 ? "VIP" : null,
  playtimeSeconds: index * 60,
});

test("online player schema accepts presence fields and strips unknown provider data", () => {
  const parsed = onlinePlayersSchema.parse([{ ...makeEntry(1), providerSecret: "never-exposed", online: true }]);
  assert.equal("providerSecret" in parsed[0], false);
  assert.equal("online" in parsed[0], false);
  assert.equal(parsed[0].playtimeSeconds, 60);
  // Explicit nulls are honest unknowns.
  const unknowns = onlinePlayersSchema.parse([{ ...makeEntry(2), rank: null, playtimeSeconds: null }]);
  assert.deepEqual([unknowns[0].rank, unknowns[0].playtimeSeconds], [null, null]);
});

test("online player schema rejects malformed entries", () => {
  const invalid: Array<Record<string, unknown>> = [
    { ...makeEntry(1), username: "bad/name" },
    { ...makeEntry(1), username: "x" },
    { ...makeEntry(1), uuid: "not-a-uuid" },
    { ...makeEntry(1), uuid: "00000000000040008000000000000001" },
    { ...makeEntry(1), rank: "" },
    { ...makeEntry(1), rank: "x".repeat(65) },
    { ...makeEntry(1), rank: "line\nbreak" },
    { ...makeEntry(1), playtimeSeconds: -1 },
    { ...makeEntry(1), playtimeSeconds: 1.5 },
    { ...makeEntry(1), playtimeSeconds: "3600" },
    { username: "Steve", uuid: "01234567-89ab-cdef-0123-456789abcdef" },
    { username: "Steve", uuid: "01234567-89ab-cdef-0123-456789abcdef", rank: null },
  ];
  for (const value of invalid) assert.equal(onlinePlayersSchema.safeParse([value]).success, false, JSON.stringify(Object.keys(value)));
});

test("service is unavailable without configuration and never calls the provider", async () => {
  let transportCalls = 0;
  const service = createOnlinePlayersService({ getConfig: () => null, transport: async () => { transportCalls++; return { status: "ok", body: [] }; } });
  assert.deepEqual(await service.load(), { status: "unavailable" });
  assert.equal(transportCalls, 0);
});

test("service fetches the online list with fixed segments and never leaks the token", async () => {
  const seen: { segments: readonly string[]; query?: Readonly<Record<string, string>> }[] = [];
  const service = createOnlinePlayersService({
    getConfig: () => config,
    transport: async (_config, segments, _fetcher, _timeout, query) => {
      seen.push({ segments, query });
      return { status: "ok", body: [{ ...makeEntry(1), internalNote: "hide-me" }, makeEntry(2)] };
    },
  });
  const result = await service.load();
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.data.length, 2);
  assert.equal(result.data[0].username, "Player1");
  assert.equal("internalNote" in result.data[0], false);
  assert.deepEqual(seen, [{ segments: ["players", "online"], query: undefined }]);
  assert.equal(JSON.stringify(result).includes(config.token), false);
});

test("an empty provider array correctly represents zero players online", async () => {
  const service = createOnlinePlayersService({ getConfig: () => config, transport: async () => ({ status: "ok", body: [] }) });
  assert.deepEqual(await service.load(), { status: "available", data: [] });
});

test("service rejects malformed payloads, duplicate players and oversized lists", async () => {
  const bodies: unknown[] = [
    { players: [] },
    "nope",
    null,
    [makeEntry(1), { ...makeEntry(1), rank: null }],
    [{ ...makeEntry(1), username: "bad/name" }],
    [{ ...makeEntry(1), playtimeSeconds: -5 }],
    Array.from({ length: 201 }, (_, index) => makeEntry(index)),
  ];
  for (const body of bodies) {
    const service = createOnlinePlayersService({ getConfig: () => config, transport: async () => ({ status: "ok", body }) });
    assert.deepEqual(await service.load(), { status: "unavailable" });
  }
});

test("service truncates the published list to the safe maximum", async () => {
  const service = createOnlinePlayersService({
    getConfig: () => config,
    transport: async () => ({ status: "ok", body: Array.from({ length: 150 }, (_, index) => makeEntry(index)) }),
  });
  const result = await service.load();
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.equal(result.data.length, MAX_ONLINE_PLAYERS);
  assert.equal(result.data[MAX_ONLINE_PLAYERS - 1].username, `Player${MAX_ONLINE_PLAYERS - 1}`);
});

test("a missing provider path is unavailable, not an empty list", async () => {
  for (const status of ["not_found", "unavailable"] as const) {
    const service = createOnlinePlayersService({ getConfig: () => config, transport: async () => ({ status }) });
    assert.deepEqual(await service.load(), { status: "unavailable" });
  }
});

test("service caches briefly and coalesces concurrent requests", async () => {
  let time = 0;
  let calls = 0;
  const service = createOnlinePlayersService({
    getConfig: () => config,
    transport: async () => { calls++; return { status: "ok", body: [makeEntry(1)] }; },
    now: () => time,
  });
  await Promise.all([service.load(), service.load(), service.load()]);
  await service.load();
  assert.equal(calls, 1);
  time = 9999;
  await service.load();
  assert.equal(calls, 1, "still cached before 10 seconds");
  time = 10001;
  await service.load();
  assert.equal(calls, 2, "refreshes after the 10 second window");
});
