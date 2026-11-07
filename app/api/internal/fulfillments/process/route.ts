import { getPrisma } from "@/lib/prisma";
import {
  createMinecraftGrantClient,
  getMinecraftGrantConfig,
} from "@/lib/minecraft/grant-client";
import { processPendingFulfillments } from "@/lib/fulfillment/fulfillment-service";

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.INTERNAL_JOB_SECRET}`;

  if (!process.env.INTERNAL_JOB_SECRET || authHeader !== expected) {
    return Response.json(
      { error: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Reject browser origins: internal-only endpoint.
  const origin = request.headers.get("origin");
  if (origin) {
    return Response.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const config = getMinecraftGrantConfig();
  if (!config) {
    return Response.json(
      { error: "MINECRAFT_NOT_CONFIGURED" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const db = getPrisma();
  const grantClient = createMinecraftGrantClient(config);

  const now = new Date();
  const result = await processPendingFulfillments(db, grantClient, now);

  return Response.json(
    {
      processed: result.processed,
      succeeded: result.succeeded,
      failed: result.failed,
      retried: result.retried,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
