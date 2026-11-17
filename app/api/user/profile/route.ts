import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { validateProfileUpdate } from "@/lib/auth-domain/dto";
import { normalizePhoneE164 } from "@/lib/auth/phone";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const dbUser = await prisma.user.findUnique({
        where: { id: auth.user.id },
        select: { id: true, emailNormalized: true, emailVerifiedAt: true, displayName: true, phoneE164: true, role: true, status: true, createdAt: true },
      });
      if (!dbUser) return jsonError("USER_NOT_FOUND", "Usuário não encontrado.", 404);
      return Response.json({ user: dbUser }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível carregar o perfil.", 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("REQUEST_FAILED", "Corpo da requisição inválido.", 400); }
  const input = validateProfileUpdate(body);
  if (!input.success) return jsonError("REQUEST_FAILED", "Dados de perfil inválidos.", 400);

  const phoneE164 = normalizePhoneE164(input.data.phoneE164 ?? null);
  if (phoneE164 === undefined) return jsonError("REQUEST_FAILED", "Telefone inválido. Use formato internacional, ex.: +5511999999999.", 400);

  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const dbUser = await prisma.user.update({
        where: { id: auth.user.id },
        data: { displayName: input.data.displayName.trim(), phoneE164 },
        select: { id: true, emailNormalized: true, emailVerifiedAt: true, displayName: true, phoneE164: true, role: true, status: true, createdAt: true },
      });
      return Response.json({ user: dbUser }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível atualizar o perfil.", 500);
  }
}
