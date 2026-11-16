import "server-only";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const deny = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
type Ctx = { params: Promise<{ slug: string }> };
export async function GET(_request: Request, { params }: Ctx) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 110) return deny();
  try {
    const item = await getPrisma().contentPost.findUnique({
      where: { slug },
      select: { status: true, publishedAt: true, imageData: true, imageMime: true },
    });
    if (!item?.imageData || !item.imageMime || item.status !== "PUBLISHED" || !item.publishedAt || item.publishedAt > new Date()) return deny();
    return new Response(Uint8Array.from(item.imageData), {
      headers: {
        "Content-Type": item.imageMime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
      },
    });
  } catch { return deny(); }
}
