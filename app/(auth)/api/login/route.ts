import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCsrfCookie } from "@/lib/auth/csrf";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { validateLogin } from "@/lib/auth-domain/dto";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { publicLoginFailure } from "@/lib/auth/errors";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import { requireCsrfToken } from "@/lib/auth/middleware";
import { generateSessionToken } from "@/lib/auth/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

function genericLoginFailure(): Response {
  return jsonError("LOGIN_FAILED", publicLoginFailure().message, 401);
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return genericLoginFailure();
  }

  const loginInput = validateLogin(body);
  if (!loginInput.success) {
    return genericLoginFailure();
  }

  const { email } = loginInput.data;
  const clientIp = getClientIp(request.headers);

  // Rate limit by email and by email+IP. Fail-closed: if either check fails,
  // reject the request. Keys are opaque hashes; raw identifiers never leave
  // the server.
  try {
    const emailKey = opaqueKey(`login:email:${email.toLowerCase().trim()}`);
    if (!(await rateLimiter.check({ key: emailKey }))) {
      return rateLimitResponse();
    }
    if (clientIp) {
      const emailIpKey = opaqueKey(`login:email+ip:${email.toLowerCase().trim()}:${clientIp}`);
      if (!(await rateLimiter.check({ key: emailIpKey }))) {
        return rateLimitResponse();
      }
    }
  } catch {
    return rateLimitResponse();
  }

  const requestId = crypto.randomUUID();

  try {
    return await withAuthServices(env, async (services) => {
      const result = await services.loginService.login({
        email,
        password: loginInput.data.password,
        rememberMe: loginInput.data.rememberMe ?? false,
        requestId,
      });

      if (!result.ok) {
        return genericLoginFailure();
      }

      const { session, rawToken } = result;
      const headers = new Headers();
      headers.set("Cache-Control", "private, no-store");
      setSessionCookie(headers, rawToken, session.absoluteExpiresAt);
      // Set CSRF cookie with a random token (not the session token)
      const csrfToken = generateSessionToken();
      setCsrfCookie(headers, csrfToken);

      return Response.json({
        ok: true,
        user: {
          id: result.user.id,
          emailNormalized: result.user.emailNormalized,
          displayName: result.user.displayName,
          role: result.user.role,
        },
      }, {
        status: 200,
        headers,
      });
    });
  } catch {
    return genericLoginFailure();
  }
}
