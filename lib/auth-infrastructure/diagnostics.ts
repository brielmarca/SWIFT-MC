import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { DiagnosticBindings } from "./bindings";
import { probeAuthDatabase } from "./prisma";
import { stagingScryptProbe } from "../auth-feasibility/crypto";

function authorized(request: Request, env: DiagnosticBindings) {
  if (env.AUTH_DIAGNOSTICS_ENVIRONMENT !== "staging" || env.AUTH_DIAGNOSTICS_ENABLED !== "1") return false;
  if (!env.AUTH_DIAGNOSTICS_TOKEN || env.AUTH_DIAGNOSTICS_TOKEN.length < 43) return false;
  const supplied = request.headers.get("authorization") ?? "";
  if (supplied.length > 256) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`Bearer ${env.AUTH_DIAGNOSTICS_TOKEN}`));
}

/** No request-controlled work factors, SQL, passwords, or iteration counts. */
export async function runAuthDiagnostic(request: Request, env: DiagnosticBindings) {
  const headers = { "Cache-Control": "private, no-store" };
  const url = new URL(request.url);
  if (!authorized(request, env) || url.protocol !== "https:") return new Response(null, { status: 404, headers });
  if (request.method !== "POST" || url.search || request.body !== null) return new Response(null, { status: 400, headers });
  try {
    if (url.pathname === "/auth-infrastructure-probe/database") {
      const connected = await probeAuthDatabase(env);
      return Response.json({ connected }, { status: connected ? 200 : 503, headers });
    }
    if (url.pathname === "/auth-infrastructure-probe/scrypt") {
      return Response.json(await stagingScryptProbe(), { headers });
    }
    return new Response(null, { status: 404, headers });
  } catch {
    // Worker termination cannot be caught: correlate with platform invocation outcomes.
    return Response.json({ status: "probe-failed" }, { status: 503, headers });
  }
}
