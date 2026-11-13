import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { validateSessionFromToken, type AuthSessionResult, type SessionValidationOptions } from "@/lib/auth/middleware";

const SESSION_COOKIE_NAME = "__Host-swiftmc_session";

export type AuthenticatedUser = NonNullable<Extract<AuthSessionResult, { authenticated: true }>["user"]>;
export type AuthenticatedPageSession = Extract<AuthSessionResult, { authenticated: true }>;

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

export async function requireAuthPage(
  cookieHeader: string | null,
  callbackUrl?: string,
): Promise<AuthenticatedUser> {
  const session = await requirePageSession(cookieHeader, callbackUrl);
  return session.user;
}

export async function getOptionalPageUser(
  cookieHeader: string | null,
): Promise<AuthenticatedUser | null> {
  const session = await getOptionalPageSession(cookieHeader);
  return session?.user ?? null;
}

export async function requirePageSession(
  cookieHeader: string | null,
  callbackUrl?: string,
  options: SessionValidationOptions = {},
): Promise<AuthenticatedPageSession> {
  const env = await getWorkersEnv();
  const token = extractSessionToken(cookieHeader);
  const loginUrl = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login";
  const adminLoginUrl = callbackUrl ? `/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/admin/login";
  if (!token) {
    redirectTo(options.requireMfa ? adminLoginUrl : loginUrl);
  }
  const result = await validateSessionFromToken(token, env, options);
  if (!result.authenticated) {
    if (options.requireMfa && (result.code === "MFA_REQUIRED" || result.code === "RECENT_AUTH_REQUIRED")) redirectTo(adminLoginUrl);
    if (options.requiredPermission && result.code === "INSUFFICIENT_PERMISSION") redirectTo("/account");
    redirectTo(options.requireMfa ? adminLoginUrl : loginUrl);
  }
  return result;
}

export async function getOptionalPageSession(
  cookieHeader: string | null,
  options: SessionValidationOptions = {},
): Promise<AuthenticatedPageSession | null> {
  const env = await getWorkersEnv();
  const token = extractSessionToken(cookieHeader);
  if (!token) return null;
  const result = await validateSessionFromToken(token, env, options);
  if (!result.authenticated) return null;
  return result as AuthenticatedPageSession;
}

function redirectTo(url: string): never {
  // Lazy import to keep server-component tests runnable without Next client router context.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("next/navigation") as { redirect: (url: string) => never };
  return mod.redirect(url);
}
