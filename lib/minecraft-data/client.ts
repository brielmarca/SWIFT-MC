import "server-only";
import { readLimitedResponse } from "@/lib/read-limited-response";

export type MinecraftDataConfig = { baseUrl: string; token: string };

export function getMinecraftDataConfig(env: Record<string, string | undefined> = process.env): MinecraftDataConfig | null {
  const rawUrl = env.MINECRAFT_DATA_API_URL?.trim();
  const token = env.MINECRAFT_DATA_API_TOKEN?.trim();
  if (!rawUrl || !token || token.length > 4096 || /[^\x21-\x7e]/.test(token)) return null;
  try {
    const url = new URL(rawUrl);
    const localHttp = env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !localHttp) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return { baseUrl: url.toString(), token };
  } catch { return null; }
}

type DataResponse = { status: "ok"; body: unknown } | { status: "not_found" | "unavailable" };

// Reusable server-only transport for stats, leaderboards and future read-only data services.
// Callers supply validated path segments and query values, never a URL from a browser request.
export async function fetchMinecraftData(
  config: MinecraftDataConfig,
  segments: readonly string[],
  fetcher: typeof fetch = fetch,
  timeoutMs = 4000,
  query?: Readonly<Record<string, string>>,
): Promise<DataResponse> {
  if (!segments.length || segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) return { status: "unavailable" };
  const entries = query ? Object.entries(query) : [];
  if (entries.length > 8 || entries.some(([key, value]) => !/^[a-zA-Z0-9_-]{1,32}$/.test(key) || !/^[a-zA-Z0-9_-]{1,16}$/.test(value))) return { status: "unavailable" };
  try {
    const url = new URL(segments.map(encodeURIComponent).join("/"), config.baseUrl);
    for (const [key, value] of entries) url.searchParams.set(key, value);
    const response = await fetcher(url.toString(), {
      method: "GET", headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 404 || response.status === 204) return { status: "not_found" };
    if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return { status: "unavailable" };
    const bytes = await readLimitedResponse(response, 16384);
    return { status: "ok", body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    // Never return upstream text, configuration, credentials, or exception messages.
    return { status: "unavailable" };
  }
}
