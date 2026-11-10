type GatewayEnv = { BACKEND_ORIGIN: string; BACKEND_PROXY_SECRET: string; APP_URL: string };

/** Single-origin frontend/API gateway. No database or provider credentials on Workers. */
export async function proxyStagingRequest(request: Request, env: GatewayEnv, upstream: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  let origin: URL;
  try {
    origin = new URL(env.BACKEND_ORIGIN);
    if (origin.protocol !== "https:" || origin.origin !== env.BACKEND_ORIGIN || origin.origin === url.origin ||
        url.origin !== env.APP_URL || ["swiftmc.com.br", "www.swiftmc.com.br"].includes(url.hostname) ||
        !env.BACKEND_PROXY_SECRET || env.BACKEND_PROXY_SECRET.length < 32) throw new Error();
  } catch { return Response.json({ error: { code: "GATEWAY_UNCONFIGURED" } }, { status: 503 }); }
  if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(request.method)) return new Response(null, { status: 405 });
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
  const headers = new Headers(request.headers);
  for (const key of ["host", "connection", "content-length", "forwarded", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-swift-backend-key"]) headers.delete(key);
  headers.set("x-swift-backend-key", env.BACKEND_PROXY_SECRET);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", "https");
  const target = new URL(origin);
  target.pathname = url.pathname;
  target.search = url.search;
  try {
    const response = await upstream(target, { method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(25_000) });
    const result = new Response(response.body, response);
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
    result.headers.set("Cache-Control", "private, no-store");
    // Absolute application redirects must remain on the public staging origin.
    const location = result.headers.get("location");
    if (location?.startsWith(origin.origin + "/")) result.headers.set("location", env.APP_URL + location.slice(origin.origin.length));
    return result;
  } catch { return Response.json({ error: { code: "BACKEND_UNAVAILABLE" } }, { status: 502, headers: { "Cache-Control": "no-store" } }); }
}

export default { fetch(request: Request, env: GatewayEnv) { return proxyStagingRequest(request, env); } };
