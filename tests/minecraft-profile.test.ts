import assert from "node:assert/strict";
import test from "node:test";
import { isJavaUsername, isMinecraftUuid, type ProfileResult } from "@/lib/minecraft-profile";
import { createProfileLookup, queryMinecraftProfile } from "@/lib/minecraft-profile-server";
import { GET } from "@/app/api/minecraft/profile/route";
import { validateCheckoutPreview } from "@/lib/checkout-preview";

test("Java names reject whitespace, control characters, paths and invalid lengths", async () => {
  for (const name of ["", "ab", "a".repeat(17), "Steve\n", "a b", "../Steve", "https://host", "João", "abc\0"]) {
    assert.equal(isJavaUsername(name), false);
    const result = await queryMinecraftProfile(name, async () => { throw new Error("Should not fetch"); });
    assert.deepEqual(result, { status: "invalid" });
  }
  assert.equal(isJavaUsername("Player_123"), true);
});

test("lookup exposes only canonical name, UUID and same-origin avatar", async () => {
  const result = await queryMinecraftProfile("steve", async (url, init) => {
    assert.equal(url, "https://api.mojang.com/users/profiles/minecraft/steve");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    return Response.json({ id: "0123456789abcdef0123456789abcdef", name: "Steve", secret: "not exposed" });
  });
  assert.deepEqual(result, { status: "found", profile: { username: "Steve", uuid: "01234567-89ab-cdef-0123-456789abcdef", avatarUrl: "/api/minecraft/avatar/01234567-89ab-cdef-0123-456789abcdef" } });
});

test("not-found and upstream failures are normalized", async () => {
  for (const status of [204, 404]) assert.deepEqual(await queryMinecraftProfile("Steve", async () => new Response(null, { status })), { status: "not_found" });
  for (const response of [new Response(null, { status: 429 }), new Response("bad json"), Response.json({ id: "bad", name: "Steve" }), Response.json({ id: "0".repeat(32), name: "Other" }), new Response("x".repeat(17000))]) {
    assert.deepEqual(await queryMinecraftProfile("Steve", async () => response), { status: "unavailable" });
  }
});

test("lookup times out and returns unavailable", async () => {
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    const result = await queryMinecraftProfile("Steve", async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("Timeout")), { once: true });
    }), 10);
    assert.deepEqual(result, { status: "unavailable" });
  } finally { clearTimeout(keepAlive); }
});

test("cache coalesces case-insensitive requests and expires negative entries", async () => {
  let time = 0;
  let calls = 0;
  const lookup = createProfileLookup(async (): Promise<ProfileResult> => { calls++; return { status: "not_found" }; }, () => time);
  await Promise.all([lookup("Steve"), lookup("steve")]);
  await lookup("STEVE");
  assert.equal(calls, 1);
  time = 30001;
  await lookup("Steve");
  assert.equal(calls, 2);
});

test("invalid endpoint input produces a small public error response", async () => {
  const response = await GET(new Request("http://localhost/api/minecraft/profile?username=bad%2Fpath"));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { status: "invalid" });
  assert.equal(isMinecraftUuid("../../avatar"), false);
  assert.equal(isMinecraftUuid("01234567-89ab-cdef-0123-456789abcdef"), true);
});

test("checkout preview validates fields without creating an order", () => {
  assert.deepEqual(validateCheckoutPreview("Steve", "steve@example.com"), { username: "", email: "" });
  const errors = validateCheckoutPreview("x", "not-an-email");
  assert.ok(errors.username);
  assert.ok(errors.email);
});
