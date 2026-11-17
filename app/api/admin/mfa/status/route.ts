import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession } from "@/lib/auth/middleware";
import { getMfaState, isPrivilegedRole } from "@/lib/auth/mfa-service";
import { hasPermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  const adminCapable = hasPermission(auth.user.role, "audit:read");
  if (!adminCapable || auth.user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  if (!env.AUTH_HYPERDRIVE) return json({ error: { code: "UNAVAILABLE", message: "Indisponível." } }, 503);
  const state = await getMfaState(auth.user.id);
  return json({ ok: true, ...state, canProvision: hasPermission(auth.user.role, "security:configure"), privileged: isPrivilegedRole(auth.user.role), mfaVerified: auth.user.isMfaVerified });
}
