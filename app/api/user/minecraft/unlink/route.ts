import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { validateMinecraftUnlink } from "@/lib/auth-domain/dto";
import { SESSION_POLICY } from "@/lib/auth/session-policy";
import { verifySensitiveReauth } from "@/lib/auth/reauth";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  let body: unknown; try { body = await request.json(); } catch { body = {}; }
  const input = validateMinecraftUnlink(body);
  if (!input.success) return jsonError("REQUEST_FAILED", "Dados inválidos.", 400);

  try {
    return await withAuthTransaction(env, async (services) => {
      const { userRepository, auditRepository } = services.repositories;
      const user = await userRepository.findById(auth.user.id);
      if (!user || user.status !== "ACTIVE") return jsonError("REQUEST_FAILED", "Conta indisponível.", 400);

      const prisma = (userRepository as unknown as { prisma: import("@prisma/client").PrismaClient }).prisma;
      const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { authenticatedAt: true } });
      const reauth = await verifySensitiveReauth({
        prisma,
        userId: user.id,
        password: input.data.currentPassword,
        sessionAuthenticatedAt: session?.authenticatedAt ?? null,
        recentAuthWindowMs: SESSION_POLICY.recentAuthenticationSeconds * 1000,
      });
      if (!reauth.ok) {
        if (reauth.reason === "PASSWORD_REQUIRED") return jsonError("REQUEST_FAILED", "Senha atual obrigatória.", 400);
        if (reauth.reason === "INVALID_PASSWORD") return jsonError("REQUEST_FAILED", "Senha inválida.", 400);
        if (reauth.reason === "RECENT_AUTH_REQUIRED") return jsonError("RECENT_AUTH_REQUIRED", "Faça login novamente para confirmar esta ação com segurança.", 403);
        return jsonError("REQUEST_FAILED", "Não foi possível confirmar sua identidade.", 400);
      }

      const now = new Date();
      const identity = await prisma.minecraftIdentity.findFirst({ where: { userId: user.id, namespace: "java" } });
      if (!identity) return jsonError("REQUEST_FAILED", "Nenhuma conta Minecraft vinculada.", 400);

      // Never revoke paid VIP entitlements. Preserve ownership on the account and
      // detach the in-game UUID so benefits cannot be delivered to an unlinked player.
      await prisma.bridgeDelivery.updateMany({
        where: { accountId: user.id, kind: "VIP", status: "PENDING" },
        data: { status: "SUPERSEDED", supersededAt: now },
      });
      await prisma.bridgeDelivery.create({
        data: {
          deliveryId: `vip_unlink_${user.id}_${now.getTime()}`,
          accountId: user.id,
          playerUuid: identity.subject,
          kind: "VIP",
          action: "REMOVE",
          vip: null,
          expiresAt: null,
          sequence: (await prisma.minecraftDeliverySequence.upsert({
            where: { accountId: user.id },
            create: { accountId: user.id, nextSeq: 2 },
            update: { nextSeq: { increment: 1 } },
            select: { nextSeq: true },
          })).nextSeq - BigInt(1),
          status: "PENDING",
        },
      });

      await prisma.vipEntitlement.updateMany({ where: { userId: user.id, minecraftUuid: identity.subject }, data: { minecraftUuid: null } });
      await prisma.minecraftLinkCode.deleteMany({ where: { userId: user.id } });
      await prisma.minecraftIdentity.deleteMany({ where: { userId: user.id, namespace: "java", id: identity.id } });
      await auditRepository.append({ eventType: "MINECRAFT_UNLINKED", outcome: "success", requestId: crypto.randomUUID(), actorUserId: user.id, subjectUserId: user.id, metadata: { reauth: reauth.method } });
      return Response.json({ ok: true, message: "Conta Minecraft desvinculada. Seus benefícios permanecem na conta e poderão ser vinculados novamente com segurança." }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível desvincular a conta Minecraft.", 400);
  }
}
