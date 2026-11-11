import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/cookies";
import { clearCsrfCookie } from "@/lib/auth/csrf";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import { requireCsrfToken } from "@/lib/auth/middleware";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

function getClientIp(headers: Headers): string | undefined {
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;
  return undefined;
}

function opaqueKey(input: string): string {
  return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex");
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const hyperdrive = env.AUTH_HYPERDRIVE;
  if (!hyperdrive) {
    return jsonError("REQUEST_FAILED", "Authentication infrastructure unavailable.", 503);
  }

  const rateLimiter = createRateLimiter(env);

  const trustedOrigin = (env.APP_URL as string) || "";
  if (!hasExactOrigin(request.headers, trustedOrigin)) {
    return jsonError("ORIGIN_REJECTED", "Request origin not trusted.", 403);
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return jsonError("ORIGIN_REJECTED", "Request origin not trusted.", 403);
  }

  // CSRF protection for state-changing POST
  const csrfError = requireCsrfToken(request);
  if (csrfError) return csrfError;

  const clientIp = getClientIp(request.headers);

  // Rate limit logout by source IP. Fail-closed; missing trusted IP shares a
  // bounded bucket instead of bypassing limits.
  try {
    const ipKey = opaqueKey(`auth:user:logout:ip:${clientIp ?? "unknown"}`);
    if (!(await rateLimiter.check({ key: ipKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  const cookie = request.headers.get("cookie") || "";
  const sessionToken = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  try {
    return await withAuthServices(env, async (services) => {
      if (sessionToken) {
        const validation = await services.sessionService.validateSession({ token: sessionToken });
        if (validation.ok) {
          await services.sessionService.revokeSession(validation.session.id);
        }
      }

      const headers = new Headers({ "Cache-Control": "private, no-store" });
      clearSessionCookie(headers);
      clearCsrfCookie(headers);

      return Response.json({ ok: true }, {
        status: 200,
        headers,
      });
    });
  } catch {
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    clearSessionCookie(headers);
    clearCsrfCookie(headers);
    return Response.json({ ok: true }, {
      status: 200,
      headers,
    });
  }
}
