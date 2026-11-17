import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 1024 * 1024; // 1 MiB after browser optimization.
const security = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function error(message: string, status: number) {
  return Response.json({ error: { message } }, { status, headers: security });
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "audit:read", requireMfa: true });
  if (auth instanceof Response) return auth;
  if (auth.user.status !== "ACTIVE") return error("Acesso negado.", 403);
  if (!hasExactOrigin(request.headers, String(env.APP_URL ?? "")) ||
      (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin"))
    return error("Origem não permitida.", 403);
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;
  if (!env.MEDIA_BUCKET) return error("Armazenamento de imagens ainda não configurado.", 503);
  if (request.headers.get("content-type") !== "image/webp") return error("Apenas imagens WebP.", 415);
  const claimed = Number(request.headers.get("content-length"));
  if (claimed > MAX_BYTES) return error("Imagem maior que 1 MB.", 413);
  if (!request.body) return error("Arquivo vazio.", 400);

  // Bounded streaming read also protects against missing or forged Content-Length.
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        return error("Imagem maior que 1 MB.", 413);
      }
      chunks.push(value);
    }
  } catch { return error("Não foi possível ler o arquivo.", 400); }
  if (size < 16) return error("Imagem inválida.", 400);
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const riff = new TextDecoder().decode(bytes.subarray(0, 4));
  const webp = new TextDecoder().decode(bytes.subarray(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return error("Arquivo WebP inválido.", 415);
  // Do not use supplied filenames as storage paths.
  const key = `admin/${crypto.randomUUID()}.webp`;
  try {
    await env.MEDIA_BUCKET.put(key, bytes.buffer, {
      httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" },
    });
  } catch { return error("Falha ao armazenar a imagem.", 503); }
  return Response.json({ ok: true, url: `/api/media/${key.slice("admin/".length)}`, size }, { status: 201, headers: security });
}
