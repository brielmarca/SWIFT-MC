import "server-only";
import { createConnection } from "node:net";
import { z } from "zod";
import { serverInfo } from "@/data/server-info";

export type ServerStatus = {
  online: boolean;
  players: number | null;
  maxPlayers: number | null;
  version: string | null;
  publicAddress: string;
};

export function getServerConfig() {
  const host = process.env.MINECRAFT_HOST?.trim() || serverInfo.defaultHost;
  const port = Number(process.env.MINECRAFT_PORT || serverInfo.defaultPort);
  const addressHost = host.includes(":") ? `[${host}]` : host;
  return {
    host,
    port,
    publicAddress: process.env.MINECRAFT_PUBLIC_ADDRESS?.trim() || `${addressHost}${port === serverInfo.defaultPort ? "" : `:${port}`}`,
  };
}

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  do {
    let byte = value & 0x7f;
    value >>>= 7;
    if (value) byte |= 0x80;
    bytes.push(byte);
  } while (value);
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset = 0): { value: number; next: number } | null {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buffer.length) return null;
    const byte = buffer[offset + i];
    value |= (byte & 0x7f) << (7 * i);
    if (!(byte & 0x80)) return { value, next: offset + i + 1 };
  }
  throw new Error("Invalid VarInt");
}

const responseSchema = z.object({
  players: z.object({ online: z.number().int().nonnegative(), max: z.number().int().nonnegative() }),
  version: z.object({ name: z.string().min(1).max(256) }),
});

// Java Server List Ping over TCP. No player samples, MOTD or favicon are exposed.
export function queryServer(config: ReturnType<typeof getServerConfig>, timeoutMs = 3000): Promise<ServerStatus> {
  const offline: ServerStatus = { online: false, players: null, maxPlayers: null, version: null, publicAddress: config.publicAddress };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535 || config.host.length > 253) return Promise.resolve(offline);

  return new Promise((resolve) => {
    const socket = createConnection({ host: config.host, port: config.port });
    let buffer = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => finish(offline), timeoutMs);
    function finish(status: ServerStatus) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(status);
    }
    socket.on("error", () => finish(offline));
    socket.on("close", () => finish(offline));
    socket.on("connect", () => {
      const host = Buffer.from(config.host);
      const port = Buffer.alloc(2);
      port.writeUInt16BE(config.port);
      const handshake = Buffer.concat([Buffer.from([0]), varInt(-1), varInt(host.length), host, port, Buffer.from([1])]);
      socket.write(Buffer.concat([varInt(handshake.length), handshake, Buffer.from([1, 0])]));
    });
    socket.on("data", (chunk: Buffer) => {
      try {
        if (buffer.length + chunk.length > 1024 * 1024) return finish(offline);
        buffer = Buffer.concat([buffer, chunk]);
        const packet = readVarInt(buffer);
        if (!packet) return;
        if (packet.value < 2 || packet.value > 1024 * 1024) return finish(offline);
        if (buffer.length < packet.next + packet.value) return;
        const payload = buffer.subarray(packet.next, packet.next + packet.value);
        const id = readVarInt(payload);
        if (!id || id.value !== 0) return finish(offline);
        const length = readVarInt(payload, id.next);
        if (!length || length.value < 0 || length.next + length.value !== payload.length) return finish(offline);
        const data = responseSchema.parse(JSON.parse(payload.subarray(length.next).toString("utf8")));
        finish({ online: true, players: data.players.online, maxPlayers: data.players.max, version: data.version.name, publicAddress: config.publicAddress });
      } catch {
        finish(offline);
      }
    });
  });
}

export function createStatusCache(load: () => Promise<ServerStatus>, ttl = 15000) {
  let cached: ServerStatus | undefined;
  let expires = 0;
  let pending: Promise<ServerStatus> | undefined;
  return () => {
    if (cached && Date.now() < expires) return Promise.resolve(cached);
    if (!pending) {
      pending = load().then((value) => {
        cached = value;
        expires = Date.now() + ttl;
        return value;
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}

export const getServerStatus = createStatusCache(() => queryServer(getServerConfig()));
