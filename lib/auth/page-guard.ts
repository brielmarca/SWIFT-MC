import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { validateSessionFromToken, type AuthSessionResult } from "@/lib/auth/middleware";

const SESSION_COOKIE_NAME = "__Host-swiftmc_session";

export type AuthenticatedUser = {
  id: string;
  emailNormalized: string | null;
  emailVerifiedAt: Date | null;
  displayName: string;
  phoneE164: string | null;
  role: string;
  status: string;
  createdAt: Date;
};

/**
 * Extracts the session token from a Cookie header value.
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
 * Requires a valid session for a Server Component page.
 * Returns the authenticated user or redirects to /login.
 * Fail-closed: missing infrastructure or invalid session results in redirect.
 *
 * Usage in a page component:
 *   export default async function MyPage({ params }: { params: Promise<{...}> }) {
 *     const user = await requireAuthPage((await headers()).get("cookie"), "/checkout");
 *     // user is guaranteed authenticated
 *   }
 *
 * Note: Pages using this must be dynamic (not statically prerendered) so the
 * check runs at request time in the Cloudflare Workers runtime where
 * cloudflare:workers bindings are available. Add `export const dynamic = "force-dynamic"`.
 */
export async function requireAuthPage(
  cookieHeader: string | null,
  callbackUrl?: string,
): Promise<AuthenticatedUser> {
  const env = await getWorkersEnv();

  const token = extractSessionToken(cookieHeader);
  if (!token) {
    const loginUrl = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    await redirectToLogin(loginUrl);
  }

  const result = await validateSessionFromToken(token as string, env);
  if (!result.authenticated) {
    const loginUrl = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    await redirectToLogin(loginUrl);
  }

  return (result as Extract<AuthSessionResult, { authenticated: true }>).user;
}

/**
 * Optional session check for Server Components that conditionally render
 * based on auth state. Returns the user or null. Safe to call during builds
 * when cloudflare:workers is unavailable (returns null).
 */
export async function getOptionalPageUser(
  cookieHeader: string | null,
): Promise<AuthenticatedUser | null> {
  const env = await getWorkersEnv();
  const token = extractSessionToken(cookieHeader);
  if (!token) return null;

  const result = await validateSessionFromToken(token, env);
  if (!result.authenticated) return null;
  return result.user;
}

/**
 * Throws a Next.js redirect to the login page.
 * Imported lazily to avoid loading next/navigation in non-Next.js contexts.
 */
async function redirectToLogin(url: string): Promise<void> {
  // Dynamic import used because "require" is not available in ESM mode.
  const { redirect } = await import("next/navigation");
  redirect(url);
}
