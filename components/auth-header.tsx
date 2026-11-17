import "server-only";
import { headers } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { getOptionalPageUser } from "@/lib/auth/page-guard";

/**
 * Server component that wraps SiteHeader with authentication state.
 * Checks the session from cookies and passes the authenticated user to SiteHeader.
 * Safe to call during builds when cloudflare:workers is unavailable (authUser will be null).
 *
 * Usage:
 *   import { AuthHeader } from "@/components/auth-header";
 *   <AuthHeader />
 */
export async function AuthHeader() {
  const cookieHeader = (await headers()).get("cookie");
  const authUser = await getOptionalPageUser(cookieHeader);
  return <SiteHeader authUser={authUser ?? undefined} />;
}
