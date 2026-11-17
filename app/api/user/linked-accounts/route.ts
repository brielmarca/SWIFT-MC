import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession } from "@/lib/auth/middleware";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const [identities, minecraft, mfa] = await Promise.all([
        prisma.authIdentity.findMany({ where: { userId: auth.user.id }, select: { provider: true, providerSubject: true, createdAt: true } }),
        prisma.minecraftIdentity.findFirst({ where: { userId: auth.user.id, namespace: "java" }, select: { subject: true, lastKnownUsername: true, verifiedAt: true } }),
        prisma.mfaCredential.findUnique({ where: { userId: auth.user.id }, select: { enabledAt: true } }),
      ]);
      const hasPassword = identities.some(i => i.provider === "EMAIL_PASSWORD");
      const discord = identities.find(i => i.provider === "DISCORD") || null;
      return Response.json({
        email: auth.user.emailNormalized,
        hasPassword,
        discord: discord ? { linked: true, providerSubject: discord.providerSubject, createdAt: discord.createdAt } : { linked: false },
        minecraft: minecraft ? { linked: true, uuid: minecraft.subject, nickname: minecraft.lastKnownUsername, verifiedAt: minecraft.verifiedAt } : { linked: false },
        mfaEnabled: !!mfa,
      }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível carregar as contas vinculadas.", 500);
  }
}
