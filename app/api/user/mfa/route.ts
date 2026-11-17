import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { getPrisma } from "@/lib/prisma";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(code: string, status: number, message: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message }, ...extra }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
function key(input: string) { return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex"); }

export async function GET(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!env.AUTH_HYPERDRIVE) return json("REQUEST_FAILED", 503, "Indisponível.");
  const prisma = getPrisma();
  const [identity, mfa] = await Promise.all([
    prisma.authIdentity.findFirst({ where: { userId: auth.user.id, provider: "DISCORD" }, select: { id: true } }),
    prisma.mfaCredential.findUnique({ where: { userId: auth.user.id }, select: { enabledAt: true } }),
  ]);
  return Response.json({ discordLinked: !!identity, mfaEnabled: !!mfa, mfaEnabledAt: mfa?.enabledAt ?? null }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  const trustedOrigin = String(env.APP_URL ?? "");
  if (!hasExactOrigin(request.headers, trustedOrigin)) return json("ORIGIN_REJECTED", 403, "Origem não permitida.");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") return json("ORIGIN_REJECTED", 403, "Origem não permitida.");
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (!env.AUTH_HYPERDRIVE || !env.AUTH_ENCRYPTION_KEY) return json("REQUEST_FAILED", 503, "MFA indisponível.");
  const rl = createRateLimiter(env);
  try { if (!(await rl.check({ key: key(`mfa:enable:${auth.user.id}`) }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }
  // MFA challenge/verification flow is incomplete for login; keep enablement unavailable until secure.
  return json("REQUEST_FAILED", 503, "MFA ainda não está disponível com segurança.");
}
