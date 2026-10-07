import "server-only";
import { isJavaUsername, isMinecraftUuid } from "@/lib/minecraft-profile";
import { lookupMinecraftProfile } from "@/lib/minecraft-profile-server";
import { fetchMinecraftData, getMinecraftDataConfig } from "./client";
import { playerStatsSchema, type PlayerStatsResult } from "./types";

type Identity = { username: string; uuid: string };
type Dependencies = {
  getConfig?: typeof getMinecraftDataConfig;
  lookupProfile?: typeof lookupMinecraftProfile;
  transport?: typeof fetchMinecraftData;
  now?: () => number;
};

export function createPlayerStatsService({ getConfig = getMinecraftDataConfig, lookupProfile = lookupMinecraftProfile, transport = fetchMinecraftData, now = Date.now }: Dependencies = {}) {
  const cache = new Map<string, { expires: number; result: PlayerStatsResult }>();
  const pending = new Map<string, Promise<PlayerStatsResult>>();

  async function getByIdentity(identity: Identity): Promise<PlayerStatsResult> {
    if (!isJavaUsername(identity.username) || !isMinecraftUuid(identity.uuid)) return { status: "invalid" };
    const config = getConfig();
    if (!config) return { status: "unavailable" };
    const key = `${identity.uuid}:${identity.username.toLowerCase()}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.result;
    if (pending.has(key)) return pending.get(key)!;
    if (pending.size >= 20) return { status: "unavailable" };

    const task = (async (): Promise<PlayerStatsResult> => {
      const response = await transport(config, ["players", identity.uuid, "stats"]);
      if (response.status !== "ok") return { status: response.status };
      const parsed = playerStatsSchema.safeParse(response.body);
      if (!parsed.success || parsed.data.uuid !== identity.uuid || parsed.data.username.toLowerCase() !== identity.username.toLowerCase()) return { status: "unavailable" };
      return { status: "available", data: { ...parsed.data, username: identity.username } };
    })().catch((): PlayerStatsResult => ({ status: "unavailable" })).then((result) => {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: now() + 15000 });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }

  async function getByUsername(username: string): Promise<PlayerStatsResult> {
    if (!isJavaUsername(username)) return { status: "invalid" };
    // Do not even query Mojang when the optional data integration is disabled.
    if (!getConfig()) return { status: "unavailable" };
    try {
      const result = await lookupProfile(username);
      if (result.status !== "found") return { status: result.status };
      return await getByIdentity(result.profile);
    } catch { return { status: "unavailable" }; }
  }

  return { getByUsername, getByIdentity };
}

export const playerStatsService = createPlayerStatsService();
