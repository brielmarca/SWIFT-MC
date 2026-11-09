import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { bridgeError, json, readJson, verifyBridgeRequest, type BridgeBindings } from "@/lib/minecraft-bridge/auth";
import { bindMinecraftLinkCode } from "@/lib/minecraft-bridge/service";

export async function POST(request: Request): Promise<Response> {
  try {
    const env = (await getWorkersEnv()) as BridgeBindings;
    const { serverId } = verifyBridgeRequest(request.headers, env);
    void serverId;
    const body = await readJson(request) as Record<string, unknown>;
    if (!env.AUTH_HYPERDRIVE) return json({ error: "database_unavailable" }, 503);
    return await withAuthPrisma(env, async db => {
      const result = await bindMinecraftLinkCode(db, {
        code: String(body.code ?? ""),
        playerUuid: String(body.playerUuid ?? ""),
        nickname: String(body.nickname ?? ""),
      });
      return json(result);
    });
  } catch (e) { return bridgeError(e); }
}
