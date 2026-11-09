import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import {
  extractCsrfTokenFromCookie, extractCsrfTokenFromHeader,
} from "@/lib/auth/csrf";
import { createHash } from "node:crypto";

const SESSION_COOKIE_NAME = "__Host-swiftmc_session";

function getClientIp(headers: Headers): string | undefined {
  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;
  return undefined;
}

function opaqueKey(input: string): string {
  return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex");
}

/**
 * Validates CSRF token: compares the token from the X-CSRF-Token header
 * against the token from the CSRF cookie (double-submit cookie pattern).
 * Returns true if valid, false otherwise.
 * Fail-closed: missing token or mismatch results in rejection.
 */
export function validateCsrfToken(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieToken = extractCsrfTokenFromCookie(cookieHeader);
  const headerToken = extractCsrfTokenFromHeader(request.headers);

  if (!cookieToken || !headerToken) return false;
  if (cookieToken !== headerToken) return false;
  return true;
}

/**
 * Requires a valid CSRF token for state-changing requests.
 * Returns a 403 Response if CSRF validation fails, or null if valid.
 */
export function requireCsrfToken(request: Request): Response | null {
  // Only enforce CSRF on state-changing methods
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  if (!validateCsrfToken(request)) {
    return Response.json(
      { error: { code: "CSRF_REJECTED", message: "Requisição CSRF inválida." } },
      { status: 403, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } },
    );
  }
  return null;
}

/**
 * Security headers that should be included on all auth API responses.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export type AuthenticatedUser = {
  id: string;
  emailNormalized: string | null;
  emailVerifiedAt: Date | null;
  displayName: string;
  role: string;
  status: string;
  createdAt: Date;
  authVersion: number;
};

export type AuthSessionResult = {
  authenticated: true;
  user: AuthenticatedUser;
  sessionId: string;
} | {
  authenticated: false;
  code?: string;
};

/**
 * Extracts the session token from a Cookie header.
 */
function extractSessionToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? null;
}

/**
 * Validates a session token against the database.
 * Returns the authenticated user or a failure result.
 * Fail-closed: any error results in unauthenticated status.
 */
export async function validateSessionFromToken(
  token: string,
  env?: Awaited<ReturnType<typeof getWorkersEnv>>,
): Promise<AuthSessionResult> {
  const bindings = env ?? (await getWorkersEnv());
  const hyperdrive = bindings.AUTH_HYPERDRIVE;
  if (!hyperdrive) {
    return { authenticated: false, code: "INFRASTRUCTURE_UNAVAILABLE" };
  }

  try {
    return await withAuthServices(bindings, async (services) => {
      const validation = await services.sessionService.validateSession({ token });
      if (!validation.ok) {
        return { authenticated: false, code: validation.code };
      }
      const { user, session } = validation;
      return {
        authenticated: true,
        user: {
          id: user.id,
          emailNormalized: user.emailNormalized,
          emailVerifiedAt: user.emailVerifiedAt,
          displayName: user.displayName,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
          authVersion: user.authVersion,
        },
        sessionId: session.id,
      };
    });
  } catch {
    return { authenticated: false, code: "SESSION_VALIDATION_ERROR" };
  }
}

/**
 * Validates a session from a Request object's cookies.
 * Suitable for API route handlers and middleware.
 */
export async function validateSessionFromRequest(
  request: Request,
  env?: Awaited<ReturnType<typeof getWorkersEnv>>,
): Promise<AuthSessionResult> {
  const cookie = request.headers.get("cookie") || "";
  const token = extractSessionToken(cookie);
  if (!token) {
    return { authenticated: false, code: "NO_SESSION" };
  }
  return validateSessionFromToken(token, env);
}

/**
 * Requires a valid session. Returns the user if authenticated, or a 401 Response
 * if not. Intended for use in API route handlers.
 */
export async function requireSession(
  request: Request,
  env?: Awaited<ReturnType<typeof getWorkersEnv>>,
): Promise<{ user: AuthenticatedUser; sessionId: string } | Response> {
  // Rate limit session validation by IP. Fail-closed.
  const bindings = env ?? await getWorkersEnv();
  const rateLimiter = createRateLimiter(bindings);
  const clientIp = getClientIp(request.headers);
  if (clientIp || bindings.AUTH_HYPERDRIVE) {
    try {
      // Missing trusted IP must not bypass limiting. Unidentified traffic shares
      // a bounded bucket; untrusted forwarded headers cannot select another one.
      const ipKey = opaqueKey(`auth:user:protected:ip:${clientIp ?? "unknown"}`);
      if (!(await rateLimiter.check({ key: ipKey }))) {
        return rateLimitResponse();
      }
    } catch {
      return rateLimitResponse();
    }
  }

  const result = await validateSessionFromRequest(request, bindings);
  if (!result.authenticated) {
    return Response.json(
      { error: { code: result.code ?? "UNAUTHENTICATED", message: "Sessão inválida ou expirada." } },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return { user: result.user, sessionId: result.sessionId };
}

/**
 * Middleware wrapper for API route handlers that require authentication.
 * Usage:
 *   export async function POST(request: Request) {
 *     const auth = await requireAuthenticated(request);
 *     if (auth instanceof Response) return auth;
 *     const { user } = auth;
 *     ...
 *   }
 */
export async function requireAuthenticated(
  request: Request,
  env?: Awaited<ReturnType<typeof getWorkersEnv>>,
): Promise<{ user: AuthenticatedUser; sessionId: string } | Response> {
  return requireSession(request, env);
}

/**
 * Check if a request has a valid session without enforcing.
 * Returns the user or null. Suitable for Server Components that conditionally
 * render content based on authentication state.
 */
export async function getOptionalSession(
  request: Request,
  env?: Awaited<ReturnType<typeof getWorkersEnv>>,
): Promise<{ user: AuthenticatedUser; sessionId: string } | null> {
  const result = await validateSessionFromRequest(request, env);
  if (!result.authenticated) return null;
  return { user: result.user, sessionId: result.sessionId };
}
