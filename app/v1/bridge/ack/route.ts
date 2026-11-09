import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { bridgeError, json, readJson, verifyBridgeRequest, type BridgeBindings } from "@/lib/minecraft-bridge/auth";
import { acknowledgeBridgeDelivery } from "@/lib/minecraft-bridge/service";

export async function POST(request: Request): Promise<Response> {
  try {
    const env = (await getWorkersEnv()) as BridgeBindings;
    const { serverId } = verifyBridgeRequest(request.headers, env);
    const body = await readJson(request) as Record<string, unknown>;
    if (body.serverId !== undefined && body.serverId !== serverId) return json({ error: "wrong server" }, 403);
    if (!env.AUTH_HYPERDRIVE) return json({ error: "database_unavailable" }, 503);
    return await withAuthPrisma(env, async db => {
      const result = await acknowledgeBridgeDelivery(db, {
        deliveryId: String(body.deliveryId ?? ""),
        sequence: Number(body.sequence),
        status: String(body.status ?? ""),
        serverId,
      });
      return json({ ok: result.ok, duplicate: result.duplicate ?? false }, result.httpStatus);
    });
  } catch (e) { return bridgeError(e); }
}
