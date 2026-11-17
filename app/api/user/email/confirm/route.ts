import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireCsrfToken, requireSession } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { validateEmailChangeConfirm } from "@/lib/auth-domain/dto";
import { createEmailChangeService } from "@/lib/auth-domain/email-change";
import { SystemClock } from "@/lib/auth-domain/clock";
import { createHash } from "node:crypto";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}
function key(input: string) { return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex"); }

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const trustedOrigin = (env.APP_URL as string) || "";
  if (!hasExactOrigin(request.headers, trustedOrigin)) return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  const auth = await requireSession(request, env); if (auth instanceof Response) return auth;
  const rl = createRateLimiter(env);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  let body: unknown; try { body = await request.json(); } catch { return jsonError("REQUEST_FAILED", "Corpo inválido.", 400); }
  const input = validateEmailChangeConfirm(body);
  if (!input.success) return jsonError("REQUEST_FAILED", "Dados inválidos.", 400);
  try {
    const emailKey = key(`email-change:confirm:${input.data.email.toLowerCase().trim()}`);
    if (!(await rl.check({ key: emailKey })) || !(await rl.check({ key: key(`email-change:confirm:ip:${ip}`) }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }
  const requestId = crypto.randomUUID();
  try {
    return await withAuthTransaction(env, async (services) => {
      const prisma = (services.repositories.userRepository as unknown as { prisma: import("@prisma/client").PrismaClient }).prisma;
      const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { authenticatedAt: true } });
      const recentAuthOk = !!(session?.authenticatedAt && Date.now() - new Date(session.authenticatedAt).getTime() <= 10 * 60 * 1000);
      const svc = createEmailChangeService({ ...services.repositories, clock: new SystemClock() });
      const result = await svc.confirmEmailChange({ email: input.data.email, challengeToken: input.data.challengeToken, currentPassword: input.data.currentPassword, recentAuthOk, requestId });
      if (!result.ok || result.userId !== auth.user.id) return jsonError("REQUEST_FAILED", "Não foi possível confirmar o novo e-mail. Confirme sua senha ou faça login novamente.", 400);
      return Response.json({ ok: true, message: "E-mail alterado com sucesso. Faça login novamente." }, { headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível confirmar o novo e-mail.", 400);
  }
}
