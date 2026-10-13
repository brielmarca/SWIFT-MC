import { playerStatsService } from "@/lib/minecraft-data/player-stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const result = await playerStatsService.getByUsername(username);
  return Response.json(result, {
    status: result.status === "invalid" ? 400 : result.status === "not_found" ? 404 : result.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
