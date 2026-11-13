import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCsrfCookie } from "@/lib/auth/csrf";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { validateRegistrationComplete } from "@/lib/auth-domain/dto";
import { withVerificationTransaction } from "@/lib/auth-api/verification-transaction";
import { createEmailVerificationService } from "@/lib/auth-domain/email-verification";
import { SystemClock } from "@/lib/auth-domain/clock";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";
import { requireCsrfToken } from "@/lib/auth/middleware";
import { generateSecurityToken } from "@/lib/auth/tokens";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("REQUEST_FAILED", "Invalid request body.", 400);
  }

  const input = validateRegistrationComplete(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Invalid registration data.", 400);
  }

  const { email, challengeToken } = input.data;
  let normalizedEmail: string;
  try {
    normalizedEmail = normalizeAuthEmail(email);
  } catch {
    return jsonError("REQUEST_FAILED", "Invalid email address.", 400);
  }

  // Rate limit verify-email by email and source IP. Fail-closed; missing
  // trusted IP shares a bounded bucket instead of bypassing limits.
  try {
    const emailKey = opaqueKey(`auth:challenge:verify-email:${normalizedEmail}`);
    if (!(await rateLimiter.check({ key: emailKey }))) {
      return rateLimitResponse();
    }
    const ipKey = opaqueKey(`auth:challenge:verify-email:ip:${clientIp ?? "unknown"}`);
    if (!(await rateLimiter.check({ key: ipKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  const requestId = crypto.randomUUID();

  try {
    return await withVerificationTransaction(env, normalizedEmail, async (services) => {
      const emailVerificationService = createEmailVerificationService({
        userRepository: services.repositories.userRepository,
        identityRepository: services.repositories.identityRepository,
        passwordCredentialRepository: services.repositories.passwordCredentialRepository,
        emailChallengeRepository: services.repositories.emailChallengeRepository,
        auditRepository: services.repositories.auditRepository,
        clock: new SystemClock(),
      });

      if (!("password" in input.data)) {
        const result = await emailVerificationService.verifyEmail({ email: normalizedEmail, challengeToken, requestId });
        if (!result.ok) return jsonError("VERIFICATION_FAILED", "Não foi possível verificar o email.", 400);
        // Verify ownership only. Existing accounts must authenticate normally;
        // never issue a session with a hardcoded authVersion or replace credentials.
        return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
      }
      const result = await emailVerificationService.completeRegistration({
        email: normalizedEmail,
        password: input.data.password,
        displayName: input.data.displayName,
        challengeToken,
        requestId,
      });

      if (!result.ok) {
        return jsonError("VERIFICATION_FAILED", "Não foi possível verificar o email.", 400);
      }

      // Issue a session for the newly verified user (no MFA trust).
      const issued = await services.sessionService.issueSession({
        userId: result.userId,
        authVersion: 1,
        rememberMe: false,
        isPrivilegedAdmin: false,
        mfaVerifiedAt: null,
      });

      if (!issued.ok) {
        throw new Error("VERIFICATION_SESSION_FAILED");
      }

      const headers = new Headers();
      headers.set("Cache-Control", "private, no-store");
      setSessionCookie(headers, issued.rawToken, issued.session.absoluteExpiresAt);
      // Set CSRF cookie with a random token (not the session token)
      const csrfToken = generateSecurityToken("csrf");
      setCsrfCookie(headers, csrfToken);

      return Response.json({
        ok: true,
        userId: result.userId,
      }, {
        status: 201,
        headers,
      });
    });
  } catch {
    return jsonError("VERIFICATION_FAILED", "Não foi possível verificar o email.", 400);
  }
}
