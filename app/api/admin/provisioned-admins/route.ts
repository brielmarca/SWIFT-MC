import "server-only";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { getPrisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ discordSubject: z.string().regex(/^\d{5,32}$/) }).strict();
function json(code: string, status: number, message: string) { return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } }); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json("FORBIDDEN", 403, "Acesso negado.");
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  const items = await getPrisma().provisionedAdmin.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, discordSubject: true, claimedAt: true, createdAt: true } });
  return Response.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json("FORBIDDEN", 403, "Acesso negado.");
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  let body: unknown; try { body = await request.json(); } catch { return json("REQUEST_FAILED", 400, "Dados inválidos."); }
  const input = schema.safeParse(body); if (!input.success) return json("REQUEST_FAILED", 400, "Discord ID inválido.");
  try {
    await getPrisma().provisionedAdmin.create({ data: { discordSubject: input.data.discordSubject } });
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return json("REQUEST_FAILED", 400, "Não foi possível salvar.");
  }
}
