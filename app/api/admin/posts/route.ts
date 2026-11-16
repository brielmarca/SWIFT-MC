import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { getPrisma } from "@/lib/prisma";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";
import { postSchema, normalizePostTags } from "@/lib/editorial/validation";

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

export async function POST(request: Request) {
  const access = await secureMutation(request);
  if (access.failure) return access.failure;
  let payload;
  try { payload = postSchema.safeParse(await readPayload(request)); }
  catch { return failure("INVALID_JSON", 400, "Conteúdo inválido ou muito grande."); }
  if (!payload.success) return failure("VALIDATION_FAILED", 400, "Revise os campos da publicação.");
  const input = payload.data;
  let tags: string;
  try { tags = normalizePostTags(input.tags); }
  catch { return failure("TAGS_INVALID", 400, "Use até 10 tags simples separadas por vírgulas."); }

  try {
    const row = await getPrisma().$transaction(async (tx) => {
      const post = await tx.contentPost.create({
        data: {
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          category: input.category,
          tags,
          body: input.body,
          featured: input.featured,
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : null,
          authorId: access.userId!,
          updatedById: access.userId!,
        },
      });
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: input.status === "PUBLISHED" ? "CONTENT_POST_PUBLISHED" : "CONTENT_POST_CREATED",
        outcome: "success",
        requestId: crypto.randomUUID(),
        actorUserId: access.userId!,
        metadata: { slug: post.slug, status: post.status },
      }) });
      return post;
    });
    return Response.json({ ok: true, id: row.id, revision: row.revision, slug: row.slug }, { status: 201, headers });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return failure("SLUG_EXISTS", 409, "Este endereço já está sendo utilizado.");
    }
    return failure("SAVE_FAILED", 503, "Não foi possível salvar a publicação.");
  }
}
