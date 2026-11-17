/**
 * Defense-in-depth for the Cloudflare -> Node boundary.
 * Origin access additionally requires the private gateway key.
 * Cloudflare itself must overwrite CF-Connecting-IP; never trust X-Forwarded-For.
 */
const HOP_BY_HOP = [
  "host", "connection", "keep-alive", "proxy-authorization", "proxy-authenticate",
  "te", "trailer", "transfer-encoding", "upgrade", "content-length",
  "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto",
  "x-real-ip", "true-client-ip", "x-swift-backend-key",
] as const;

export function cleanGatewayHeaders(source: Headers, key: string, publicHost: string): Headers {
  const clean = new Headers(source);
  for (const name of HOP_BY_HOP) clean.delete(name);
  // Cloudflare normally injects a trusted CF-Connecting-IP. Never forward
  // malformed/multi-value client IPs into the application's limiter keys.
  const edgeIp = source.get("cf-connecting-ip") ?? "";
  clean.delete("cf-connecting-ip");
  if (/^[0-9a-f:.]{3,45}$/i.test(edgeIp) && !edgeIp.includes("..")) {
    clean.set("cf-connecting-ip", edgeIp);
  }
  clean.set("x-swift-backend-key", key);
  clean.set("x-forwarded-host", publicHost);
  clean.set("x-forwarded-proto", "https");
  return clean;
}

/**
 * Only explicitly public site documents should be indexed. Never strip an
 * upstream noindex from account, checkout, admin, auth or API responses.
 */
const PUBLIC_PAGES = new Set([
  "/", "/play", "/store", "/status", "/lore", "/vote", "/privacy", "/cookies",
  "/terms", "/refund", "/wiki", "/news", "/events", "/rules", "/faq",
  "/player", "/online", "/leaderboards", "/community",
]);
const PUBLIC_PREFIXES = ["/store/", "/ranks/", "/player/", "/wiki/", "/news/", "/events/", "/rules/", "/faq/"];
const SEO_FILES = new Set(["/robots.txt", "/sitemap.xml"]);

export function isPublicIndexablePath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname) || PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
    || SEO_FILES.has(pathname);
}

export function applyGatewayResponseSecurity(response: Response, pathname: string, method: string): void {
  const safeRead = method === "GET" || method === "HEAD";
  const publicAsset = pathname.startsWith("/_next/static/") || pathname.startsWith("/brand/");
  if (!safeRead || !publicAsset || response.status !== 200 || response.headers.has("set-cookie")) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.delete("CDN-Cache-Control");
    response.headers.delete("Cloudflare-CDN-Cache-Control");
  }
  if (safeRead && response.status === 200 && !response.headers.has("set-cookie") &&
      isPublicIndexablePath(pathname)) {
    // Remove a stale upstream staging noindex from canonical public documents.
    // Explicit privacy headers remain on all other paths.
    response.headers.delete("X-Robots-Tag");
  } else if (!publicAsset && !isPublicIndexablePath(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
}
