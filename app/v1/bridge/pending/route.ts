import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { bridgeError, json, verifyBridgeRequest, type BridgeBindings } from "@/lib/minecraft-bridge/auth";
import { listPendingBridgeDeliveries } from "@/lib/minecraft-bridge/service";

export async function GET(request: Request): Promise<Response> {
  try {
    const env = (await getWorkersEnv()) as BridgeBindings;
    const { serverId } = verifyBridgeRequest(request.headers, env);
    if (!env.AUTH_HYPERDRIVE) return json({ error: "database_unavailable" }, 503);
    return await withAuthPrisma(env, async db => json(await listPendingBridgeDeliveries(db, serverId)));
  } catch (e) { return bridgeError(e); }
}
