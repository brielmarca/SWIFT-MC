import { leaderboardService, parseLeaderboardQuery } from "@/lib/minecraft-data/leaderboards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = parseLeaderboardQuery(new URL(request.url).searchParams);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (query.status === "invalid") return Response.json({ status: "invalid" }, { status: 400, headers });
  const result = await leaderboardService.get(query.category, query.limit);
  return Response.json(result, {
    status: result.status === "invalid" ? 400 : result.status === "unavailable" ? 503 : 200,
    headers,
  });
}
