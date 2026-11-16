import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { getPrisma } from "@/lib/prisma";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";
import { updatePostSchema, normalizePostTags } from "@/lib/editorial/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const failure = (code: string, status: number, message = "Não foi possível concluir a operação.") =>
  Response.json({ error: { code, message } }, { status, headers });
async function secureMutation(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "content:manage", requireMfa: true });
  if (auth instanceof Response) return { failure: auth };
  if (!env.AUTH_HYPERDRIVE) return { failure: failure("UNAVAILABLE", 503) };
  if (auth.user.status !== "ACTIVE" || !["ADMIN", "OWNER"].includes(auth.user.role)) return { failure: failure("FORBIDDEN", 403) };
  if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? ""))) return { failure: failure("ORIGIN_REJECTED", 403) };
  const csrf = requireCsrfToken(request); if (csrf) return { failure: csrf };
  return { userId: auth.user.id };
}
async function readPayload(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > 25600) throw new Error("PAYLOAD_TOO_LARGE");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 25600) throw new Error("PAYLOAD_TOO_LARGE");
  return JSON.parse(body);
}

type Ctx = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Ctx) {
  const access = await secureMutation(request);
  if (access.failure) return access.failure;
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) return failure("INVALID_ID", 400);
  let parsed;
  try { parsed = updatePostSchema.safeParse(await readPayload(request)); }
  catch { return failure("INVALID_JSON", 400); }
  if (!parsed.success) return failure("VALIDATION_FAILED", 400, "Revise os campos da publicação.");
  const input = parsed.data;
  let tags: string;
  try { tags = normalizePostTags(input.tags); }
  catch { return failure("TAGS_INVALID", 400, "Use até 10 tags válidas."); }

  try {
    const row = await getPrisma().$transaction(async (tx) => {
      const previous = await tx.contentPost.findUnique({ where: { id } });
      if (!previous || previous.status === "ARCHIVED") return null;
      // Stable slugs avoid breaking links and duplicating indexed URLs.
      if (previous.slug !== input.slug) return { error: "SLUG_IMMUTABLE" as const };
      const updated = await tx.contentPost.updateMany({
        where: { id, revision: input.revision, status: { not: "ARCHIVED" } },
        data: {
          title: input.title, excerpt: input.excerpt, category: input.category, tags,
          body: input.body, featured: input.featured, status: input.status,
          publishedAt: input.status === "PUBLISHED" && previous.status !== "PUBLISHED" ? new Date() : previous.publishedAt,
          updatedById: access.userId!, revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) return { error: "STALE_VERSION" as const };
      const event = previous.status !== input.status
        ? (input.status === "PUBLISHED" ? "CONTENT_POST_PUBLISHED" : "CONTENT_POST_UNPUBLISHED")
        : "CONTENT_POST_UPDATED";
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: event, outcome: "success", actorUserId: access.userId!,
        requestId: crypto.randomUUID(), metadata: { slug: previous.slug, status: input.status },
      }) });
      return { revision: input.revision + 1 };
    });
    if (row === null) return failure("NOT_FOUND", 404);
    if ("error" in row) return failure(row.error ?? "CONFLICT", 409, row.error === "STALE_VERSION" ? "Esta publicação foi modificada por outra pessoa. Recarregue a página." : "O endereço da publicação não pode ser alterado.");
    return Response.json({ ok: true, revision: row.revision }, { headers });
  } catch {
    return failure("SAVE_FAILED", 503);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const access = await secureMutation(request);
  if (access.failure) return access.failure;
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) return failure("INVALID_ID", 400);
  let payload: unknown;
  try { payload = await readPayload(request); } catch { return failure("INVALID_JSON", 400); }
  if (typeof payload !== "object" || payload === null || !("revision" in payload)
    || typeof payload.revision !== "number" || !Number.isSafeInteger(payload.revision) || payload.revision < 1) {
    return failure("VALIDATION_FAILED", 400);
  }
  try {
    const row = await getPrisma().$transaction(async (tx) => {
      const previous = await tx.contentPost.findUnique({ where: { id } });
      if (!previous || previous.status === "ARCHIVED") return "NOT_FOUND";
      const updated = await tx.contentPost.updateMany({
        where: { id, revision: payload.revision as number, status: { not: "ARCHIVED" } },
        data: { status: "ARCHIVED", updatedById: access.userId!, revision: { increment: 1 } },
      });
      if (!updated.count) return "STALE_VERSION";
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: "CONTENT_POST_ARCHIVED", outcome: "success", actorUserId: access.userId!,
        requestId: crypto.randomUUID(), metadata: { slug: previous.slug },
      }) });
      return "OK";
    });
    if (row !== "OK") return failure(row, row === "NOT_FOUND" ? 404 : 409);
    return Response.json({ ok: true }, { headers });
  } catch {
    return failure("SAVE_FAILED", 503);
  }
}
