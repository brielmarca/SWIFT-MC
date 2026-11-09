import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { validatePasswordReset } from "@/lib/auth-domain/dto";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { createEmailService } from "@/lib/auth/email-service";
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

  const input = validatePasswordReset(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Invalid request data.", 400);
  }

  const { email } = input.data;
  const clientIp = getClientIp(request.headers);

  // Rate limit password reset requests by email and IP. Fail-closed.
  try {
    const emailKey = opaqueKey(`auth:challenge:password-reset:${email.toLowerCase().trim()}`);
    if (!(await rateLimiter.check({ key: emailKey }))) {
      return rateLimitResponse();
    }
    if (clientIp) {
      const ipKey = opaqueKey(`auth:challenge:password-reset:ip:${clientIp}`);
      if (!(await rateLimiter.check({ key: ipKey }))) {
        return rateLimitResponse();
      }
    }
  } catch {
    return rateLimitResponse();
  }

  const requestId = crypto.randomUUID();
  const emailService = createEmailService(env);

  try {
    return await withAuthServices(env, async (services) => {
      const result = await services.passwordResetService.requestPasswordReset({ email, requestId });

      if (result.challengeToken && emailService) {
        try {
          await emailService.sendPasswordResetEmail({
            to: email,
            token: result.challengeToken,
          });
        } catch (error) {
          // Log server-side so the failure is never silent. Never include
          // email content, recipient, or API key in the client response.
          // Always return a generic 200 to prevent account enumeration via
          // HTTP status code.
          console.error("Password reset email delivery failed:", String(error));
        }
      }

      return Response.json({
        ok: true,
        acknowledgement: "Se for possível, enviaremos as instruções para o email informado.",
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch {
    return Response.json({
      ok: true,
      acknowledgement: "Se for possível, enviaremos as instruções para o email informado.",
    }, {
      status: 200,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}