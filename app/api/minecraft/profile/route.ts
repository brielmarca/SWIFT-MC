import { lookupMinecraftProfile } from "@/lib/minecraft-profile-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username") || "";
  const result = await lookupMinecraftProfile(username);
  return Response.json(result, {
    status: result.status === "invalid" ? 400 : result.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
