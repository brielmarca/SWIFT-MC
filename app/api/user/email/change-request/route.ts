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
    // Commit the challenge before contacting the email provider; network latency
    // must not hold the auth transaction or cause an emailed token to roll back.
    const result = await withAuthTransaction(env, async (services) => {
      const prisma = (services.repositories.userRepository as unknown as { prisma: import("@prisma/client").PrismaClient }).prisma;
      const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { authenticatedAt: true } });
      const recentAuthOk = !!(session?.authenticatedAt && Date.now() - new Date(session.authenticatedAt).getTime() <= 10 * 60 * 1000);
      const svc = createEmailChangeService({ ...services.repositories, clock: new SystemClock() });
      return svc.requestEmailChange({ userId: auth.user.id, newEmail: input.data.newEmail, currentPassword: input.data.currentPassword, recentAuthOk, requestId });
    });

    if (!result.ok) {
      if (result.code === "RECENT_AUTH_REQUIRED") return jsonError("RECENT_AUTH_REQUIRED", "Para verificar o e-mail, autentique-se novamente pelo Discord e tente em até 10 minutos.", 403);
      if (result.code === "PASSWORD_REQUIRED") return jsonError("PASSWORD_REQUIRED", "Esta conta possui senha cadastrada. Informe a senha atual para alterar o e-mail.", 403);
      if (result.code === "EMAIL_UNCHANGED") return jsonError("EMAIL_UNCHANGED", "Este e-mail já pertence à conta. Use a opção de reenviar verificação caso ainda não esteja confirmado.", 409);
      return jsonError("REQUEST_FAILED", "Não foi possível solicitar a verificação de e-mail.", 400);
    }
    // Keep the same generic client acknowledgement for unavailable emails and
    // delivery failures to prevent email-address enumeration. Operational logs
    // include no addresses, tokens or credentials.
    if (!result.challengeToken) {
      console.info("[swiftmc-email] change-request skipped", { requestId, reason: "address_unavailable" });
    } else {
      const emailService = createEmailService(env);
      if (!emailService) {
        console.error("[swiftmc-email] change-request delivery unavailable", { requestId, reason: "email_provider_unconfigured" });
      } else {
        try {
          await emailService.sendEmailChangeVerificationEmail({ to: input.data.newEmail.trim().toLowerCase(), token: result.challengeToken });
          console.info("[swiftmc-email] change-request accepted by provider", { requestId });
        } catch (error) {
          const status = error instanceof Error ? /Resend API error: (\\d{3})/.exec(error.message)?.[1] : undefined;
          console.error("[swiftmc-email] change-request delivery failed", { requestId, providerHttpStatus: status ?? "unknown" });
        }
      }
    }
    return Response.json({ ok: true, acknowledgement: result.acknowledgement }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    console.error("[swiftmc-email] change-request failed before delivery", { requestId });
    return jsonError("REQUEST_FAILED", "Não foi possível solicitar a verificação de e-mail.", 400);
  }
}
