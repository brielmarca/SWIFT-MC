import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { validateRegistration } from "@/lib/auth-domain/dto";
import { withVerificationTransaction } from "@/lib/auth-api/verification-transaction";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import { requireCsrfToken } from "@/lib/auth/middleware";
import { createEmailService } from "@/lib/auth/email-service";

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

  const input = validateRegistration(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Invalid registration data.", 400);
  }

  const { email } = input.data;
  let normalizedEmail: string;
  try { normalizedEmail = normalizeAuthEmail(email); }
  catch { return jsonError("REQUEST_FAILED", "Invalid email address.", 400); }
  const clientIp = getClientIp(request.headers);

  // Rate limit registration by email and source IP. Fail-closed; missing
  // trusted IP shares a bounded bucket instead of bypassing limits.
  try {
    const emailKey = opaqueKey(`auth:challenge:register:${normalizedEmail}`);
    if (!(await rateLimiter.check({ key: emailKey }))) {
      return rateLimitResponse();
    }
    const ipKey = opaqueKey(`auth:challenge:register:ip:${clientIp ?? "unknown"}`);
    if (!(await rateLimiter.check({ key: ipKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  const requestId = crypto.randomUUID();
  const emailService = createEmailService(env);

  try {
      const result = await withVerificationTransaction(env, normalizedEmail, (services) => services.registrationService.requestRegistration({
        email: normalizedEmail,
        requestId,
      }));

      if (!result.ok) {
        return jsonError("REGISTER_FAILED", "Não foi possível criar a conta.", 400);
      }

      // Preserve generic responses for unknown, already verified, and other
      // addresses to avoid email enumeration; use private PII-free diagnostics.
      if (!result.challengeToken) {
        console.info("[swiftmc-email] registration-or-resend skipped", { requestId, reason: "not_eligible" });
      } else if (!emailService) {
        console.error("[swiftmc-email] registration-or-resend delivery unavailable", { requestId, reason: "email_provider_unconfigured" });
      } else {
        try {
          await emailService.sendVerificationEmail({
            to: email,
            token: result.challengeToken,
            existingAccount: result.existingAccount,
          });
          console.info("[swiftmc-email] registration-or-resend accepted by provider", { requestId });
        } catch (error) {
          const status = error instanceof Error ? /Resend API error: (\d{3})/.exec(error.message)?.[1] : undefined;
          console.error("[swiftmc-email] registration-or-resend delivery failed", { requestId, providerHttpStatus: status ?? "unknown" });
        }
      }

      return Response.json({
        ok: true,
        acknowledgement: result.acknowledgement,
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
  } catch {
    console.error("[swiftmc-email] registration-or-resend failed before delivery", { requestId });
    return jsonError("REGISTER_FAILED", "Não foi possível criar a conta.", 400);
  }
}
