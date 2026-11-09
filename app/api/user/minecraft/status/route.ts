import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireSession } from "@/lib/auth/middleware";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";
import { getBridgeLinkStatus } from "@/lib/minecraft-bridge/service";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
}

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  try {
    return await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async prisma => {
      const status = await getBridgeLinkStatus(prisma, { accountId: auth.user.id });
      return Response.json(status, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    });
  } catch (e) {
    console.error("minecraft-status-error", e);
    return jsonError("REQUEST_FAILED", "Não foi possível carregar o status do Minecraft.", 500);
  }
}
