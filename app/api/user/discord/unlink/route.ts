import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { validateDiscordUnlink } from "@/lib/auth-domain/dto";
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
  const input = validateDiscordUnlink(body);
  if (!input.success) return jsonError("REQUEST_FAILED", "Dados inválidos.", 400);

  try {
    return await withAuthTransaction(env, async (services) => {
      const { userRepository, identityRepository, sessionRepository, auditRepository } = services.repositories;
      const user = await userRepository.findById(auth.user.id);
      if (!user || user.status !== "ACTIVE") return jsonError("REQUEST_FAILED", "Conta indisponível.", 400);
      const discord = await identityRepository.findByUserAndProvider(user.id, "DISCORD");
      if (!discord) return jsonError("REQUEST_FAILED", "Nenhuma conta Discord vinculada.", 400);
      const passwordIdentity = await identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      // Prevent lockout: Discord-only users cannot unlink their only sign-in method.
      if (!passwordIdentity) return jsonError("REQUEST_FAILED", "Defina uma senha antes de desvincular o Discord para não perder acesso à conta.", 400);

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

      // Clean up Discord-bound MFA to avoid orphan/lock issues; admin privileges remain server-controlled.
      await prisma.mfaCredential.deleteMany({ where: { userId: user.id } });
      await identityRepository.deleteByUserAndProvider(user.id, "DISCORD");
      const bumped = await userRepository.bumpAuthVersion(user.id, user.authVersion);
      if (!bumped) return jsonError("REQUEST_FAILED", "Conflito de segurança. Tente novamente.", 409);
      await sessionRepository.revokeAllForUser(user.id);
      await auditRepository.append({ eventType: "DISCORD_UNLINKED", outcome: "success", requestId: crypto.randomUUID(), actorUserId: user.id, subjectUserId: user.id, metadata: { reauth: reauth.method } });
      return Response.json({ ok: true, message: "Conta Discord desvinculada. Faça login novamente." }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível desvincular a conta Discord.", 400);
  }
}
