import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { bridgeError, json, readJson, verifyBridgeRequest, type BridgeBindings } from "@/lib/minecraft-bridge/auth";
import { getBridgeLinkStatus } from "@/lib/minecraft-bridge/service";

export async function GET(request: Request): Promise<Response> {
  try {
    const env = (await getWorkersEnv()) as BridgeBindings;
    verifyBridgeRequest(request.headers, env);
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const playerUuid = url.searchParams.get("playerUuid") ?? undefined;
    if (!env.AUTH_HYPERDRIVE) return json({ error: "database_unavailable" }, 503);
    return await withAuthPrisma(env, async db => json(await getBridgeLinkStatus(db, { accountId, playerUuid })));
  } catch (e) { return bridgeError(e); }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = (await getWorkersEnv()) as BridgeBindings;
    verifyBridgeRequest(request.headers, env);
    const body = await readJson(request) as Record<string, unknown>;
    if (!env.AUTH_HYPERDRIVE) return json({ error: "database_unavailable" }, 503);
    return await withAuthPrisma(env, async db => json(await getBridgeLinkStatus(db, {
      accountId: typeof body.accountId === "string" ? body.accountId : undefined,
      playerUuid: typeof body.playerUuid === "string" ? body.playerUuid : undefined,
    })));
  } catch (e) { return bridgeError(e); }
}
