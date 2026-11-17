import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import {
  createMinecraftGrantClient,
  getMinecraftGrantConfig,
} from "@/lib/minecraft/grant-client";
import { processPendingFulfillments } from "@/lib/fulfillment/fulfillment-service";

type FulfillmentBindings = {
  INTERNAL_JOB_SECRET?: string;
  MINECRAFT_FULFILLMENT_URL?: string;
  MINECRAFT_FULFILLMENT_TOKEN?: string;
};

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  // The Worker runtime exposes declared bindings, not process.env.
  const env = await getWorkersEnv();
  const bindings = env as typeof env & FulfillmentBindings;

  const authHeader = request.headers.get("authorization");
  const jobSecret = bindings.INTERNAL_JOB_SECRET;

  if (!jobSecret || authHeader !== `Bearer ${jobSecret}`) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401, headers });
  }

  // Reject browser origins: internal-only endpoint.
  const origin = request.headers.get("origin");
  if (origin) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403, headers });
  }

  const config = getMinecraftGrantConfig({
    MINECRAFT_FULFILLMENT_URL: bindings.MINECRAFT_FULFILLMENT_URL,
    MINECRAFT_FULFILLMENT_TOKEN: bindings.MINECRAFT_FULFILLMENT_TOKEN,
  });
  if (!config) {
    return Response.json(
      { error: "MINECRAFT_NOT_CONFIGURED" },
      { status: 503, headers },
    );
  }

  // The Worker runtime has no DATABASE_URL; the database is reached only
  // through the Hyperdrive binding.
  if (!env.AUTH_HYPERDRIVE) {
    return Response.json(
      { error: "DATABASE_UNAVAILABLE" },
      { status: 503, headers },
    );
  }

  try {
    return await withAuthPrisma(env, async (db) => {
      const grantClient = createMinecraftGrantClient(config);
      const result = await processPendingFulfillments(db, grantClient, new Date());

      return Response.json(
        {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          retried: result.retried,
        },
        { status: 200, headers },
      );
    });
  } catch {
    return Response.json({ error: "INTERNAL_ERROR" }, { status: 500, headers });
  }
}
