import { onlinePlayersService } from "@/lib/minecraft-data/online-players";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await onlinePlayersService.load();
  return Response.json(result, {
    status: result.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
