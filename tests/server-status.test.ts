import assert from "node:assert/strict";
import { createServer, type Socket } from "node:net";
import test from "node:test";
import { createStatusCache, queryServer, type ServerStatus } from "@/lib/server-status";

async function withServer(handler: (socket: Socket) => void, run: (port: number) => Promise<void>) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    handler(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try { await run(address.port); } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const config = (port: number) => ({ host: "127.0.0.1", port, publicAddress: "play.example.com" });

test("Minecraft status parses fragmented protocol response, including zero online players", async () => {
  const json = Buffer.from(JSON.stringify({ players: { online: 0, max: 100 }, version: { name: "1.21.4" } }));
  assert.ok(json.length < 125);
  await withServer((socket) => {
    socket.once("data", (request) => {
      assert.deepEqual([...request.subarray(-2)], [1, 0]);
      const packet = Buffer.concat([Buffer.from([json.length + 2, 0, json.length]), json]);
      socket.write(packet.subarray(0, 4));
      setTimeout(() => socket.end(packet.subarray(4)), 10);
    });
  }, async (port) => {
    assert.deepEqual(await queryServer(config(port)), {
      online: true, players: 0, maxPlayers: 100, version: "1.21.4", publicAddress: "play.example.com",
    });
  });
});

test("unresponsive server times out without exposing fabricated counts", async () => {
  await withServer(() => {}, async (port) => {
    const result = await queryServer(config(port), 30);
    assert.deepEqual(result, { online: false, players: null, maxPlayers: null, version: null, publicAddress: "play.example.com" });
  });
});

test("malformed JSON, oversized frames and invalid status fields fail gracefully", async () => {
  for (const packet of [Buffer.from([3, 0, 1, 123]), Buffer.from([255, 255, 127]), Buffer.from([4, 0, 2, 123, 125])]) {
    await withServer((socket) => socket.once("data", () => socket.end(packet)), async (port) => {
      assert.equal((await queryServer(config(port))).online, false);
    });
  }
});

test("connection refusal returns offline", async () => {
  let closedPort = 0;
  await withServer(() => {}, async (port) => { closedPort = port; });
  assert.equal((await queryServer(config(closedPort))).online, false);
});

test("cache shares concurrent requests, caches offline responses and expires", async () => {
  let calls = 0;
  const offline: ServerStatus = { online: false, players: null, maxPlayers: null, version: null, publicAddress: "play.example.com" };
  const read = createStatusCache(async () => { calls++; return offline; }, 20);
  await Promise.all([read(), read(), read()]);
  await read();
  assert.equal(calls, 1);
  await new Promise((resolve) => setTimeout(resolve, 30));
  await read();
  assert.equal(calls, 2);
});
