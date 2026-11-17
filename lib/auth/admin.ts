import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission, type AuthPermission } from "@/lib/auth/permissions";
import { getOptionalPageSession, requirePageSession } from "@/lib/auth/page-guard";

const ADMIN_BASE_PERMISSION: AuthPermission = "audit:read";

function isAuthorizedAdmin(user: { status: string; role: string }, permission: AuthPermission) {
  return user.status === "ACTIVE" && hasPermission(user.role, ADMIN_BASE_PERMISSION) && hasPermission(user.role, permission);
}

export async function requireAdminPage(permission: AuthPermission = ADMIN_BASE_PERMISSION, callbackUrl = "/console-r7m4q9v2") {
  const cookie = (await headers()).get("cookie");
  const session = await requirePageSession(cookie, callbackUrl, { requiredPermission: permission, requireMfa: true });
  if (!isAuthorizedAdmin(session.user, permission) || !session.user.isMfaVerified) redirect(callbackUrl.startsWith("/console-r7m4q9v2") ? "/console-r7m4q9v2/login" : "/account");
  return session.user;
}

export async function getAdminPageUser(permission: AuthPermission = ADMIN_BASE_PERMISSION) {
  const cookie = (await headers()).get("cookie");
  const session = await getOptionalPageSession(cookie, { requiredPermission: permission, requireMfa: true });
  if (!session || !isAuthorizedAdmin(session.user, permission) || !session.user.isMfaVerified) return null;
  return session.user;
}
