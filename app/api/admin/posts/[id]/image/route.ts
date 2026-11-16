import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";
import { validateEditorImage } from "@/lib/editorial/image-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const fail = (code: string, status: number, message: string) => Response.json({ error: { code, message } }, { status, headers: privateHeaders });
type Ctx = { params: Promise<{ id: string }> };

async function guard(request: Request, mutation: boolean) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "content:manage", requireMfa: true });
  if (auth instanceof Response) return { denied: auth };
  if (!env.AUTH_HYPERDRIVE || !["ADMIN", "OWNER"].includes(auth.user.role) || auth.user.status !== "ACTIVE") {
    return { denied: fail("FORBIDDEN", 403, "Acesso negado.") };
  }
  if (mutation) {
    if (!hasTrustedBrowserMutation(request.headers, String(env.APP_URL ?? ""))) return { denied: fail("ORIGIN", 403, "Origem inválida.") };
    const csrf = requireCsrfToken(request);
    if (csrf) return { denied: csrf };
  }
  return { userId: auth.user.id };
}

export async function GET(request: Request, { params }: Ctx) {
  const access = await guard(request, false);
  if (access.denied) return access.denied;
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) return fail("NOT_FOUND", 404, "Imagem não encontrada.");
  const row = await getPrisma().contentPost.findUnique({
    where: { id }, select: { imageData: true, imageMime: true },
  });
  if (!row?.imageData || !row.imageMime) return fail("NOT_FOUND", 404, "Imagem não encontrada.");
  return new Response(Uint8Array.from(row.imageData), { headers: { ...privateHeaders, "Content-Type": row.imageMime, "Content-Disposition": "inline" } });
}

export async function POST(request: Request, { params }: Ctx) {
  const access = await guard(request, true);
  if (access.denied) return access.denied;
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) return fail("NOT_FOUND", 404, "Publicação não encontrada.");
  const length = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(length) || length > 780_000) return fail("TOO_LARGE", 413, "Imagem excede o limite de 700 KB.");
  let upload: Awaited<ReturnType<typeof validateEditorImage>>;
  let revision: number;
  try {
    const form = await request.formData();
    const file = form.get("image");
    const alt = form.get("alt");
    const rev = form.get("revision");
    revision = Number(rev);
    if (!(file instanceof File) || typeof alt !== "string" || !Number.isSafeInteger(revision) || revision < 1) throw new Error("INVALID_FORM");
    upload = await validateEditorImage(file, alt);
  } catch { return fail("INVALID_IMAGE", 400, "Envie PNG, JPG ou WebP de até 700 KB com descrição de imagem."); }
  try {
    const result = await getPrisma().$transaction(async tx => {
      const row = await tx.contentPost.findUnique({ where: { id }, select: { slug: true, status: true } });
      if (!row || row.status === "ARCHIVED") return "NOT_FOUND";
      const updated = await tx.contentPost.updateMany({
        where: { id, revision, status: { not: "ARCHIVED" } },
        data: { imageData: Buffer.from(upload.data), imageMime: upload.mime, imageAlt: upload.alt, revision: { increment: 1 }, updatedById: access.userId! },
      });
      if (updated.count !== 1) return "STALE_VERSION";
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: "CONTENT_IMAGE_UPLOADED", outcome: "success", requestId: crypto.randomUUID(),
        actorUserId: access.userId!, metadata: { slug: row.slug },
      }) });
      return "OK";
    });
    if (result !== "OK") return fail(result, result === "NOT_FOUND" ? 404 : 409, "Atualize a publicação e tente novamente.");
    return Response.json({ ok: true, revision: revision + 1 }, { headers: privateHeaders });
  } catch { return fail("UPLOAD_FAILED", 503, "Não foi possível enviar a imagem."); }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const access = await guard(request, true);
  if (access.denied) return access.denied;
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) return fail("NOT_FOUND", 404, "Publicação não encontrada.");
  let revision: number;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || !("revision" in body) || typeof body.revision !== "number") throw Error();
    revision = body.revision;
    if (!Number.isSafeInteger(revision) || revision < 1) throw Error();
  } catch { return fail("INVALID_REVISION", 400, "Revisão inválida."); }
  try {
    const result = await getPrisma().$transaction(async tx => {
      const row = await tx.contentPost.findUnique({ where: { id }, select: { slug: true, status: true } });
      if (!row || row.status === "ARCHIVED") return "NOT_FOUND";
      const updated = await tx.contentPost.updateMany({
        where: { id, revision, status: { not: "ARCHIVED" } },
        data: { imageData: null, imageMime: null, imageAlt: null, revision: { increment: 1 }, updatedById: access.userId! },
      });
      if (updated.count !== 1) return "STALE_VERSION";
      await tx.authAuditEvent.create({ data: buildAuthAuditRecord({
        eventType: "CONTENT_IMAGE_REMOVED", outcome: "success", requestId: crypto.randomUUID(),
        actorUserId: access.userId!, metadata: { slug: row.slug },
      }) });
      return "OK";
    });
    if (result !== "OK") return fail(result, result === "NOT_FOUND" ? 404 : 409, "Atualize a publicação e tente novamente.");
    return Response.json({ ok: true, revision: revision + 1 }, { headers: privateHeaders });
  } catch { return fail("DELETE_FAILED", 503, "Não foi possível remover a imagem."); }
}
