import { getPrisma } from "@/lib/prisma";
import { assertStagingEnvironment } from "@/lib/staging-config";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    assertStagingEnvironment(process.env);
    const db = getPrisma();
    await db.$queryRaw`SELECT 1 FROM "AuthRateBucket" LIMIT 1`;
    await db.$queryRaw`SELECT "cashAmount" FROM "Order" LIMIT 1`;
    await db.user.findFirst({ select: { id: true } });
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
