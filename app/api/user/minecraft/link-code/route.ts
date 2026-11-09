import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";
import { generateMinecraftLinkCode } from "@/lib/minecraft-bridge/service";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (auth.user.status !== "ACTIVE") return jsonError("USER_NOT_ACTIVE", "Conta indisponível.", 403);
  if (!auth.user.emailVerifiedAt) return jsonError("EMAIL_NOT_VERIFIED", "Verifique seu e-mail antes de vincular o Minecraft.", 403);
  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async prisma => {
      const result = await generateMinecraftLinkCode(prisma, auth.user.id);
      return Response.json(result, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    });
  } catch (e) {
    console.error("minecraft-link-code-error", e);
    return jsonError("REQUEST_FAILED", "Não foi possível gerar o código.", 500);
  }
}
