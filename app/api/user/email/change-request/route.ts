import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { validateEmailChangeRequest } from "@/lib/auth-domain/dto";
import { createEmailChangeService } from "@/lib/auth-domain/email-change";
import { SystemClock } from "@/lib/auth-domain/clock";
import { createEmailService } from "@/lib/auth/email-service";
import { createHash } from "node:crypto";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
function key(input: string) { return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex"); }

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  const rl = createRateLimiter(env);
  try {
    if (!(await rl.check({ key: key(`email-change:req:${auth.user.id}`) }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }

  let body: unknown; try { body = await request.json(); } catch { return jsonError("REQUEST_FAILED", "Corpo inválido.", 400); }
  const input = validateEmailChangeRequest(body);
  if (!input.success) return jsonError("REQUEST_FAILED", "Dados inválidos.", 400);
  const requestId = crypto.randomUUID();

  try {
    return await withAuthTransaction(env, async (services) => {
      const prisma = (services.repositories.userRepository as unknown as { prisma: import("@prisma/client").PrismaClient }).prisma;
      const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { authenticatedAt: true } });
      const recentAuthOk = !!(session?.authenticatedAt && Date.now() - new Date(session.authenticatedAt).getTime() <= 10 * 60 * 1000);
      const svc = createEmailChangeService({ ...services.repositories, clock: new SystemClock() });
      const result = await svc.requestEmailChange({ userId: auth.user.id, newEmail: input.data.newEmail, currentPassword: input.data.currentPassword, recentAuthOk, requestId });
      if (!result.ok) return jsonError("REQUEST_FAILED", "Não foi possível solicitar a alteração de e-mail. Confirme sua senha atual ou faça login novamente.", 400);
      if (result.challengeToken) {
        const emailService = createEmailService(env);
        if (emailService) {
          try { await emailService.sendEmailChangeVerificationEmail({ to: input.data.newEmail.trim().toLowerCase(), token: result.challengeToken }); }
          catch { console.error("Email change verification delivery failed"); }
        }
      }
      return Response.json({ ok: true, acknowledgement: result.acknowledgement }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível solicitar a alteração de e-mail.", 400);
  }
}
