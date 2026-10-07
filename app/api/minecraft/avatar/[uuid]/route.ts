import { isMinecraftUuid } from "@/lib/minecraft-profile";
import { readLimitedResponse } from "@/lib/read-limited-response";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  if (!isMinecraftUuid(uuid)) return new Response(null, { status: 400 });
  const view = new URL(request.url).searchParams.get("view") || "head";
  if (view !== "head" && view !== "body") return new Response(null, { status: 400 });
  const imageUrl = view === "body"
    ? `https://crafatar.com/renders/body/${uuid}?scale=6&overlay`
    : `https://crafatar.com/avatars/${uuid}?size=64&overlay`;
  try {
    const response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(4000), redirect: "error", next: { revalidate: 3600 },
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png")) throw new Error("Unavailable avatar");
    const bytes = await readLimitedResponse(response, 65536);
    const image = new Uint8Array(bytes).buffer;
    const signature = new Uint8Array(image, 0, Math.min(image.byteLength, 8));
    if (image.byteLength > 65536 || signature.length !== 8 || !signature.every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) throw new Error("Invalid avatar");
    return new Response(image, { headers: { "Content-Type": "image/png", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=3600" } });
  } catch { return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
