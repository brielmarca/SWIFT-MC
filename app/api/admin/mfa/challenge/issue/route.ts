import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { getMfaState, issueMfaChallenge } from "@/lib/auth/mfa-service";
import { hasPermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ purpose: z.enum(["ELEVATION","LOGIN","DISABLE"]).default("ELEVATION") }).strict();
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } }); }
function key(s: string) { return createHash("sha256").update(`swiftmc:mfa:${s}`).digest("hex"); }

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  if (!hasExactOrigin(request.headers, String(env.APP_URL ?? "")) || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return json({ error: { code: "ORIGIN_REJECTED", message: "Origem não permitida." } }, 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  const rl = createRateLimiter(env); const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try { if (!(await rl.check({ key: key(`challenge:user:${auth.user.id}`) })) || !(await rl.check({ key: key(`challenge:ip:${ip}`) }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }
  const state = await getMfaState(auth.user.id);
  if (!state.enabled) return json({ error: { code: "MFA_NOT_CONFIGURED", message: "MFA não configurado." } }, 403);
  let body: unknown = {}; try { body = await request.json(); } catch { /* no body */ }
  const input = schema.safeParse(body); const purpose = input.success ? input.data.purpose : "ELEVATION";
  const res = await issueMfaChallenge({ userId: auth.user.id, sessionId: auth.sessionId, purpose, requestId: crypto.randomUUID() });
  return json({ ok: true, challengeToken: res.challengeToken, expiresAt: res.expiresAt, purpose });
}
