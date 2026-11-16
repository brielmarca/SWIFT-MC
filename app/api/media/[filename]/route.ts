import { getWorkersEnv } from "@/lib/auth-api/get-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i.test(filename))
    return new Response(null, { status: 404 });
  const env = await getWorkersEnv();
  if (!env.MEDIA_BUCKET) return new Response(null, { status: 503 });
  const object = await env.MEDIA_BUCKET.get(`admin/${filename}`);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
