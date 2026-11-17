import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession } from "@/lib/auth/middleware";
import { getPrisma } from "@/lib/prisma";
import { parseAdminPrivacyQuery } from "@/lib/privacy-request-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const json = (body: object, status: number) => Response.json(body, { status, headers });

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "audit:read", requireMfa: true });
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE" || !["ADMIN", "OWNER"].includes(auth.user.role))
    return json({ error: "Acesso negado." }, 403);
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Indisponível." }, 503);
  const query = parseAdminPrivacyQuery(request.url);
  if (!query) return json({ error: "Filtros inválidos." }, 400);
  try {
    const rows = await getPrisma().privacyRequest.findMany({
      where: query.status ? { status: query.status } : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 26, skip: (query.page - 1) * 25,
      select: { id: true, kind: true, status: true, details: true, createdAt: true, updatedAt: true,
        user: { select: { displayName: true, emailNormalized: true } } },
    });
    return json({ requests: rows.slice(0, 25), page: query.page, hasNext: rows.length > 25 }, 200);
  } catch { return json({ error: "Não foi possível consultar solicitações." }, 503); }
}
