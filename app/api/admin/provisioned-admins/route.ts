import "server-only";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { getPrisma } from "@/lib/prisma";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  discordSubject: z.string().regex(/^\d{5,32}$/),
  targetRole: z.enum(["ADMIN"]).default("ADMIN"),
}).strict();
function json(code: string, status: number, message: string) { return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } }); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "security:configure", requireMfa: true });
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return json("FORBIDDEN", 403, "Acesso negado.");
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  const items = await getPrisma().provisionedAdmin.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: { id: true, discordSubject: true, targetRole: true, claimedAt: true, consumedAt: true, createdAt: true, grantedByUserId: true } });
  return Response.json({ items }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "security:configure", requireMfa: true });
  if (auth instanceof Response) return auth;
  const trustedOrigin = String(env.APP_URL ?? "");
  if (!hasExactOrigin(request.headers, trustedOrigin)) return json("ORIGIN_REJECTED", 403, "Origem não permitida.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return json("ORIGIN_REJECTED", 403, "Origem não permitida.");
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (auth.user.status !== "ACTIVE") return json("FORBIDDEN", 403, "Acesso negado.");
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  let body: unknown; try { body = await request.json(); } catch { return json("REQUEST_FAILED", 400, "Dados inválidos."); }
  const input = schema.safeParse(body); if (!input.success) return json("REQUEST_FAILED", 400, "Dados inválidos.");
  // Initial/OWNER provisioning is an operationally controlled procedure, not a self-service UI/API action.
  // This endpoint only allows provisioning additional ADMINs by an already-authorized OWNER with MFA.
  if (input.data.targetRole !== "ADMIN") return json("FORBIDDEN", 403, "Provisionamento de OWNER não permitido por esta interface.");
  try {
    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      await tx.provisionedAdmin.create({
        data: {
          discordSubject: input.data.discordSubject,
          targetRole: "ADMIN",
          grantedByUserId: auth.user.id,
        },
      });
      await tx.authAuditEvent.create({
        data: buildAuthAuditRecord({
          eventType: "ADMIN_PROVISIONED",
          outcome: "success",
          requestId: crypto.randomUUID(),
          actorUserId: auth.user.id,
          subjectUserId: null,
          metadata: { reason: "PROVISIONED_ADMIN_CREATED" },
        }),
      });
    });
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return json("REQUEST_FAILED", 400, "Não foi possível salvar.");
  }
}
