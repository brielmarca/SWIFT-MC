import "server-only";
// This module is copied into the app only for the Workers fixture build.
// @ts-expect-error Runtime module provided by workerd, absent from Node's type declarations.
import { env } from "cloudflare:workers";
import { probeDatabase } from "@/lib/auth-feasibility/prisma";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("database") === "1") {
    if (!env.AUTH_HYPERDRIVE) return Response.json({ status: "binding-not-configured" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    try {
      return Response.json({ connected: await probeDatabase(env.AUTH_HYPERDRIVE) }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return Response.json({ status: "connection-failed" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
  }
  return Response.json({
    runtimeBindingAccess: typeof env.ASSETS?.fetch === "function",
    hyperdriveConfigured: typeof env.AUTH_HYPERDRIVE?.connectionString === "string",
    rateLimitConfigured: typeof env.AUTH_RATE_LIMIT?.limit === "function",
    coordinatorConfigured: typeof env.AUTH_RATE_LIMIT_COORDINATOR?.idFromName === "function",
    // Only presence flags cross the serialization boundary. Never return env or credentials.
    secretsConfigured: [env.AUTH_RATE_LIMIT_KEY, env.AUTH_ENCRYPTION_KEY, env.DISCORD_CLIENT_SECRET].every((value) => typeof value === "string" && value.length > 0),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
