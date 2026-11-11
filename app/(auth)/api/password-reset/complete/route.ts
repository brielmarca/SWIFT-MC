import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { validatePasswordResetComplete } from "@/lib/auth-domain/dto";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("REQUEST_FAILED", "Invalid request body.", 400);
  }

  const input = validatePasswordResetComplete(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Invalid request data.", 400);
  }

  const { email, challengeToken } = input.data;
  const clientIp = getClientIp(request.headers);

  // Rate limit password reset completion by email and source IP. Fail-closed;
  // missing trusted IP shares a bounded bucket instead of bypassing limits.
  try {
    const emailKey = opaqueKey(`auth:challenge:password-reset-complete:${email.toLowerCase().trim()}`);
    if (!(await rateLimiter.check({ key: emailKey }))) {
      return rateLimitResponse();
    }
    const ipKey = opaqueKey(`auth:challenge:password-reset-complete:ip:${clientIp ?? "unknown"}`);
    if (!(await rateLimiter.check({ key: ipKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  const requestId = crypto.randomUUID();

  try {
    return await withAuthTransaction(env, async (services) => {
      const result = await services.passwordResetService.completePasswordReset({
        email,
        challengeToken,
        newPassword: input.data.newPassword,
        requestId,
      });

      if (!result.ok) {
        return jsonError("RESET_FAILED", "Não foi possível redefinir a senha.", 400);
      }

      return Response.json({
        ok: true,
        userId: result.userId,
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return jsonError("RESET_FAILED", "Não foi possível redefinir a senha.", 400);
  }
}
