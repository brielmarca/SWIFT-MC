import "server-only";
import { verifyPassword } from "@/lib/auth/password";
import type { PrismaClient } from "@prisma/client";

export type ReauthResult =
  | { ok: true; method: "password" | "recent_session" }
  | { ok: false; reason: "PASSWORD_REQUIRED" | "INVALID_PASSWORD" | "RECENT_AUTH_REQUIRED" | "UNAVAILABLE" };

export async function verifySensitiveReauth(params: {
  prisma: PrismaClient;
  userId: string;
  password?: string | null;
  sessionAuthenticatedAt?: Date | null;
  recentAuthWindowMs: number;
}): Promise<ReauthResult> {
  const passwordIdentity = await params.prisma.authIdentity.findFirst({ where: { userId: params.userId, provider: "EMAIL_PASSWORD" }, select: { id: true } });
  if (passwordIdentity) {
    if (!params.password) return { ok: false, reason: "PASSWORD_REQUIRED" };
    const cred = await params.prisma.passwordCredential.findUnique({ where: { identityId: passwordIdentity.id }, select: { passwordHash: true } });
    if (!cred || !(await verifyPassword(params.password, cred.passwordHash))) return { ok: false, reason: "INVALID_PASSWORD" };
    return { ok: true, method: "password" };
  }
  const at = params.sessionAuthenticatedAt ? new Date(params.sessionAuthenticatedAt).getTime() : NaN;
  if (Number.isFinite(at) && Date.now() - at <= params.recentAuthWindowMs) {
    return { ok: true, method: "recent_session" };
  }
  return { ok: false, reason: "RECENT_AUTH_REQUIRED" };
}
