import "server-only";
import { Prisma } from "@prisma/client";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { privacyRequestInputSchema } from "@/lib/privacy-request-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
function json(body: object, status: number) { return Response.json(body, { status, headers }); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json({ error: "Conta indisponível." }, 403);
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Serviço indisponível." }, 503);
  try {
    const requests = await getPrisma().privacyRequest.findMany({
      where: { userId: auth.user.id },
      select: { id: true, kind: true, status: true, createdAt: true, updatedAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50,
    });
    return json({ requests }, 200);
  } catch { return json({ error: "Não foi possível consultar solicitações." }, 503); }
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json({ error: "Conta indisponível." }, 403);
  if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? ""))) return json({ error: "Origem inválida." }, 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (!env.AUTH_HYPERDRIVE) return json({ error: "Serviço indisponível." }, 503);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "Envie JSON." }, 415);
  const input = privacyRequestInputSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return json({ error: "Solicitação inválida. Limite de 800 caracteres." }, 400);
  try {
    const db = getPrisma();
    const existing = await db.privacyRequest.findFirst({
      where: { userId: auth.user.id, kind: input.data.kind, status: { in: ["OPEN", "IN_REVIEW"] } },
      select: { id: true, status: true, createdAt: true },
    });
    if (existing) return json({ ok: true, alreadyRequested: true, request: existing }, 200);
    const created = await db.privacyRequest.create({
      data: { userId: auth.user.id, kind: input.data.kind, details: input.data.details || null },
      select: { id: true, status: true, createdAt: true },
    });
    return json({ ok: true, alreadyRequested: false, request: created }, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      return json({ ok: true, alreadyRequested: true }, 200);
    return json({ error: "Não foi possível registrar a solicitação." }, 503);
  }
}
