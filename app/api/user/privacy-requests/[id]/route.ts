import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession } from "@/lib/auth/middleware";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const json = (body: object, status: number) => Response.json(body, { status, headers });
const ID = /^[a-z0-9]{10,32}$/;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json({ error: "Acesso negado." }, 403);
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Indisponível." }, 503);
  const { id } = await params;
  if (!ID.test(id)) return json({ error: "Identificador inválido." }, 400);
  try {
    const row = await getPrisma().privacyRequest.findFirst({
      where: { id, userId: auth.user.id },
      select: { id: true, kind: true, status: true, details: true, createdAt: true, updatedAt: true },
    });
    return row ? json({ request: row }, 200) : json({ error: "Solicitação não encontrada." }, 404);
  } catch { return json({ error: "Indisponível." }, 503); }
}
