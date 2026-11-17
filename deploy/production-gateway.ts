import { applyGatewayResponseSecurity, cleanGatewayHeaders } from "./gateway-security";

type GatewayEnv = { BACKEND_ORIGIN: string; BACKEND_PROXY_SECRET: string; APP_URL: string };

/** Single-origin production gateway. No database or provider credentials on Workers. */
export async function proxyProductionRequest(request: Request, env: GatewayEnv, upstream: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  // Normalize both insecure HTTP links and www before validating the secure backend origin.
  // Some in-app browsers initially request http:// even when Safari uses https://.
  if (["swiftmc.com.br", "www.swiftmc.com.br"].includes(url.hostname) &&
      (url.protocol === "http:" || url.origin === "https://www.swiftmc.com.br")) {
    return Response.redirect(`https://swiftmc.com.br${url.pathname}${url.search}`, 308);
  }
  let origin: URL;
  try {
    origin = new URL(env.BACKEND_ORIGIN);
    if (origin.protocol !== "https:" || origin.origin !== env.BACKEND_ORIGIN || origin.origin === url.origin ||
        url.origin !== env.APP_URL || env.APP_URL !== "https://swiftmc.com.br" ||
        !env.BACKEND_PROXY_SECRET || env.BACKEND_PROXY_SECRET.length < 32) throw new Error();
  } catch { return Response.json({ error: { code: "GATEWAY_UNCONFIGURED" } }, { status: 503 }); }
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) return new Response(null, { status: 405 });
  // Conflicting message framing cannot be proxied safely.
  if (request.headers.has("transfer-encoding") && request.headers.has("content-length"))
    return new Response(null, { status: 400, headers: { "Cache-Control": "no-store" } });
  // Buffer a bounded body without parsing it: Stripe signature bytes remain intact.
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (request.body) {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 1024 * 1024) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(chunk.value);
    }
    body = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  }
  const headers = cleanGatewayHeaders(request.headers, env.BACKEND_PROXY_SECRET, url.host);
  const target = new URL(origin);
  target.pathname = url.pathname;
  target.search = url.search;
  try {
    const response = await upstream(target, { method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(25_000) });
    const result = new Response(response.body, response);
    applyGatewayResponseSecurity(result, url.pathname, request.method);
    // HTTPS-only production site; do not include subdomains until each is audited.
    result.headers.set("Strict-Transport-Security", "max-age=31536000");
    // Absolute application redirects must remain on the public production origin.
    const location = result.headers.get("location");
    if (location?.startsWith(origin.origin + "/")) result.headers.set("location", env.APP_URL + location.slice(origin.origin.length));
    return result;
  } catch { return Response.json({ error: { code: "BACKEND_UNAVAILABLE" } }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}

export default { fetch(request: Request, env: GatewayEnv) { return proxyProductionRequest(request, env); } };
