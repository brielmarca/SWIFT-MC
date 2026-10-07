import "server-only";
import { isJavaUsername, type ProfileResult } from "./minecraft-profile";
import { readLimitedResponse } from "./read-limited-response";

// Fixed upstream destination; no client-supplied URLs or payment dependencies.
export async function queryMinecraftProfile(username: string, fetcher: typeof fetch = fetch, timeoutMs = 4000): Promise<ProfileResult> {
  if (!isJavaUsername(username)) return { status: "invalid" };
  try {
    const response = await fetcher(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`, {
      signal: AbortSignal.timeout(timeoutMs), redirect: "error", cache: "no-store",
    });
    if (response.status === 404 || response.status === 204) return { status: "not_found" };
    if (!response.ok) return { status: "unavailable" };
    const raw: unknown = JSON.parse(new TextDecoder().decode(await readLimitedResponse(response, 16384)));
    if (!raw || typeof raw !== "object" || !("id" in raw) || !("name" in raw)) return { status: "unavailable" };
    if (typeof raw.id !== "string" || raw.id.length !== 32 || /[^a-f0-9]/i.test(raw.id) || typeof raw.name !== "string" || !isJavaUsername(raw.name) || raw.name.toLowerCase() !== username.toLowerCase()) return { status: "unavailable" };
    const id = raw.id.toLowerCase();
    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    return { status: "found", profile: { username: raw.name, uuid, avatarUrl: `/api/minecraft/avatar/${uuid}` } };
  } catch { return { status: "unavailable" }; }
}

export function createProfileLookup(load = queryMinecraftProfile, now = Date.now) {
  const cache = new Map<string, { expires: number; result: ProfileResult }>();
  const pending = new Map<string, Promise<ProfileResult>>();
  return async (username: string): Promise<ProfileResult> => {
    if (!isJavaUsername(username)) return { status: "invalid" };
    const key = username.toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return cached.result;
    if (pending.has(key)) return pending.get(key)!;
    // Bound memory and upstream concurrency, including random-name requests.
    if (pending.size >= 20) return { status: "unavailable" };
    const promise = load(username).catch((): ProfileResult => ({ status: "unavailable" })).then((result) => {
      if (cache.size >= 200) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: now() + (result.status === "found" ? 300000 : 30000) });
      return result;
    }).finally(() => pending.delete(key));
    pending.set(key, promise);
    return promise;
  };
}

export const lookupMinecraftProfile = createProfileLookup();
