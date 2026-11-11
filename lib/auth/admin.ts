import "server-only";
import { headers } from "next/headers";
import { getOptionalPageUser, requireAuthPage } from "@/lib/auth/page-guard";
import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth/permissions";

export async function requireAdminPage(callbackUrl = "/admin") {
  const cookie = (await headers()).get("cookie");
  const user = await requireAuthPage(cookie, callbackUrl);
  if (user.status !== "ACTIVE" || !hasPermission(user.role, "audit:read")) redirect("/account");
  return user;
}

export async function getAdminPageUser() {
  const cookie = (await headers()).get("cookie");
  const user = await getOptionalPageUser(cookie);
  if (!user || user.status !== "ACTIVE" || !hasPermission(user.role, "audit:read")) return null;
  return user;
}
