import { getServerStatus } from "@/lib/server-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getServerStatus(), {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=15" },
  });
}
