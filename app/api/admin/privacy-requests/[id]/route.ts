import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";
import { adminPrivacyActionSchema, PRIVACY_ACTION_TARGETS, PRIVACY_ACTION_AUDIT_EVENTS, readPrivacyJson } from "@/lib/privacy-request-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const json = (body: object, status: number) => Response.json(body, { status, headers });
const ID = /^[a-z0-9]{10,32}$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "audit:read", requireMfa: true });
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE" || !["ADMIN", "OWNER"].includes(auth.user.role))
    return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? "")))
    return json({ error: { code: "ORIGIN_REJECTED", message: "Origem inválida." } }, 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (!env.AUTH_HYPERDRIVE) return json({ error: { code: "UNAVAILABLE", message: "Indisponível." } }, 503);
  const { id } = await params;
  if (!ID.test(id)) return json({ error: { code: "INVALID_ID", message: "Identificador inválido." } }, 400);
  let body: unknown;
  try { body = await readPrivacyJson(request); }
  catch (error) { return json({ error: { code: "INVALID_JSON", message: "Corpo inválido ou muito grande." } }, error instanceof RangeError ? 413 : 400); }
  const parsed = adminPrivacyActionSchema.safeParse(body);
  if (!parsed.success) return json({ error: { code: "INVALID_ACTION", message: "Transição ou confirmação inválida." } }, 400);
  const input = parsed.data;
  // Only the OWNER can attest final legal handling. This does not export/delete data or issue refunds.
  if (["COMPLETE", "REJECT"].includes(input.action) && auth.user.role !== "OWNER")
    return json({ error: { code: "FORBIDDEN", message: "Confirmação final restrita ao responsável." } }, 403);
  const next = PRIVACY_ACTION_TARGETS[input.action];
  try {
    const result = await getPrisma().$transaction(async tx => {
      const old = await tx.privacyRequest.findUnique({ where: { id }, select: { id: true, userId: true, kind: true, status: true } });
      if (!old) return { error: "NOT_FOUND" as const };
      if (old.status !== input.expectedStatus) return { error: "CONFLICT" as const };
      const updated = await tx.privacyRequest.updateMany({ where: { id, status: input.expectedStatus }, data: { status: next } });
      if (updated.count !== 1) return { error: "CONFLICT" as const };
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: PRIVACY_ACTION_AUDIT_EVENTS[input.action], outcome: "success",
        requestId: crypto.randomUUID(), actorUserId: auth.user.id, subjectUserId: old.userId,
        metadata: { kind: old.kind, status: next },
      }) });
      return { status: next };
    });
    if ("error" in result) return json({ error: { code: result.error, message: result.error === "NOT_FOUND" ? "Solicitação não encontrada." : "Solicitação alterada por outra operação. Recarregue." } }, result.error === "NOT_FOUND" ? 404 : 409);
    return json({ ok: true, id, status: result.status }, 200);
  } catch { return json({ error: { code: "UPDATE_FAILED", message: "Não foi possível atualizar a solicitação." } }, 503); }
}
