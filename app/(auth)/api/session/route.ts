import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";

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

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const hyperdrive = env.AUTH_HYPERDRIVE;
  if (!hyperdrive) {
    return jsonError("REQUEST_FAILED", "Authentication infrastructure unavailable.", 503);
  }

  const rateLimiter = createRateLimiter(env);

  const clientIp = getClientIp(request.headers);

  // Rate limit session checks by source IP. Fail-closed; missing trusted IP
  // shares a bounded bucket instead of bypassing limits.
  try {
    const ipKey = opaqueKey(`auth:user:session:ip:${clientIp ?? "unknown"}`);
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
    .find((c) => c.startsWith("__Host-swiftmc_session="))
    ?.split("=")
    .slice(1)
    .join("=");

  if (!sessionToken) {
    return Response.json({ ok: false, authenticated: false }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
    });
  }

  try {
    return await withAuthServices(env, async (services) => {
      const validation = await services.sessionService.validateSession({ token: sessionToken });
      if (!validation.ok) {
        return Response.json({ ok: false, authenticated: false, code: validation.code }, {
          status: 401,
          headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
        });
      }

      const { user, session } = validation;
      return Response.json({
        ok: true,
        authenticated: true,
        user: {
          id: user.id,
          emailNormalized: user.emailNormalized,
          displayName: user.displayName,
          role: user.role,
        },
        session: {
          id: session.id,
          idleExpiresAt: session.idleExpiresAt,
          absoluteExpiresAt: session.absoluteExpiresAt,
        },
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
      });
    });
  } catch {
    return Response.json({ ok: false, authenticated: false }, {
      status: 401,
      headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
    });
  }
}
