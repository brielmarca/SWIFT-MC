import "server-only";
import { fetchMinecraftData, getMinecraftDataConfig } from "./client";
import { MAX_ONLINE_PLAYERS, onlinePlayersSchema, type OnlinePlayersResult } from "./types";

type Dependencies = {
  getConfig?: typeof getMinecraftDataConfig;
  transport?: typeof fetchMinecraftData;
  now?: () => number;
};

// Defensive cap above MAX_ONLINE_PLAYERS; the byte bound also limits the payload.
const MAX_UPSTREAM_PLAYERS = 200;

export function createOnlinePlayersService({ getConfig = getMinecraftDataConfig, transport = fetchMinecraftData, now = Date.now }: Dependencies = {}) {
  let cached: { expires: number; result: OnlinePlayersResult } | undefined;
  let pending: Promise<OnlinePlayersResult> | undefined;

  async function load(): Promise<OnlinePlayersResult> {
    const config = getConfig();
    if (!config) return { status: "unavailable" };
    if (cached && cached.expires > now()) return cached.result;
    if (pending) return pending;
    pending = (async (): Promise<OnlinePlayersResult> => {
      const response = await transport(config, ["players", "online"]);
      // A missing path means the provider integration is incomplete; 0 players must be `200 []`.
      if (response.status !== "ok") return { status: "unavailable" };
      if (!Array.isArray(response.body) || response.body.length > MAX_UPSTREAM_PLAYERS) return { status: "unavailable" };
      const parsed = onlinePlayersSchema.safeParse(response.body);
      if (!parsed.success) return { status: "unavailable" };
      // A player cannot be online twice.
      if (new Set(parsed.data.map((player) => player.uuid)).size !== parsed.data.length) return { status: "unavailable" };
      return { status: "available", data: parsed.data.slice(0, MAX_ONLINE_PLAYERS) };
    })().catch((): OnlinePlayersResult => ({ status: "unavailable" })).then((result) => {
      // 10s cache for a fast-moving list, including failure states.
      cached = { result, expires: now() + 10000 };
      return result;
    }).finally(() => { pending = undefined; });
    return pending;
  }

  return { load };
}

export const onlinePlayersService = createOnlinePlayersService();
