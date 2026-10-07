import assert from "node:assert/strict";
import test from "node:test";
import { addRecentPlayer, MAX_RECENT_PLAYERS, parseRecentPlayers } from "@/lib/recent-players";
import { GET as getAvatar } from "@/app/api/minecraft/avatar/[uuid]/route";

test("recent searches reject malformed storage and invalid names", () => {
  for (const value of [null, "bad-json", "{}", "null", "x".repeat(4097)]) assert.deepEqual(parseRecentPlayers(value), []);
  assert.deepEqual(parseRecentPlayers('["Steve","steve","../bad",42,"Alex"]'), ["Steve", "Alex"]);
});

test("recent searches are bounded and repeat searches move to the front", () => {
  let names: string[] = [];
  for (let index = 0; index < 12; index++) names = addRecentPlayer(names, `Player${index}`);
  assert.equal(names.length, MAX_RECENT_PLAYERS);
  assert.equal(names[0], "Player11");
  names = addRecentPlayer(names, "PLAYER7");
  assert.equal(names[0], "PLAYER7");
  assert.equal(names.filter((name) => name.toLowerCase() === "player7").length, 1);
  assert.deepEqual(addRecentPlayer(names, "bad/name"), names);
});

const uuid = "01234567-89ab-cdef-0123-456789abcdef";
const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

test("avatar proxy supports only fixed head/body providers and retains limits and caching", async (context) => {
  const urls: string[] = [];
  context.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    urls.push(url);
    assert.equal(init.redirect, "error");
    assert.ok(init.signal);
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  });
  for (const view of ["head", "body"]) {
    const response = await getAvatar(new Request(`http://localhost/api/minecraft/avatar/${uuid}?view=${view}`), { params: Promise.resolve({ uuid }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Content-Type"), "image/png");
    assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600");
    assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  }
  assert.deepEqual(urls, [`https://crafatar.com/avatars/${uuid}?size=64&overlay`, `https://crafatar.com/renders/body/${uuid}?scale=6&overlay`]);
  const invalidView = await getAvatar(new Request(`http://localhost/api/minecraft/avatar/${uuid}?view=https://evil.example`), { params: Promise.resolve({ uuid }) });
  assert.equal(invalidView.status, 400);
  assert.equal(urls.length, 2);
});

test("skin render errors never expose raw responses", async (context) => {
  const responses = [
    new Response("private provider error", { status: 502 }),
    new Response("not a png", { headers: { "Content-Type": "image/png" } }),
    new Response(new Uint8Array(65537), { headers: { "Content-Type": "image/png" } }),
  ];
  context.mock.method(globalThis, "fetch", async () => responses.shift()!);
  for (let index = 0; index < 3; index++) {
    const response = await getAvatar(new Request(`http://localhost/api/minecraft/avatar/${uuid}?view=body`), { params: Promise.resolve({ uuid }) });
    assert.equal(response.status, 503);
    assert.equal(await response.text(), "");
  }
});
