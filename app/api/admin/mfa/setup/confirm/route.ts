import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { confirmMfaSetup } from "@/lib/auth/mfa-service";
import { hasPermission } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
function json(body: unknown, status = 200) { return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } }); }
function key(s: string) { return createHash("sha256").update(`swiftmc:mfa:${s}`).digest("hex"); }

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasExactOrigin(request.headers, String(env.APP_URL ?? "")) || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return json({ error: { code: "ORIGIN_REJECTED", message: "Origem não permitida." } }, 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  let body: unknown; try { body = await request.json(); } catch { return json({ error: { code: "INVALID", message: "Dados inválidos." } }, 400); }
  const input = schema.safeParse(body); if (!input.success) return json({ error: { code: "INVALID", message: "Código inválido." } }, 400);
  const rl = createRateLimiter(env); const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try { if (!(await rl.check({ key: key(`confirm:user:${auth.user.id}`) })) || !(await rl.check({ key: key(`confirm:ip:${ip}`) }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }
  const res = await confirmMfaSetup({ env, userId: auth.user.id, code: input.data.code, requestId: crypto.randomUUID() });
  if (!res.ok) return json({ error: { code: res.code, message: "Não foi possível confirmar o MFA." } }, 400);
  return json({ ok: true, recoveryCodes: res.recoveryCodes });
}
