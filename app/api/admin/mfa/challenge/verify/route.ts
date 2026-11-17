import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { verifyMfaChallenge } from "@/lib/auth/mfa-service";
import { hasPermission } from "@/lib/auth/permissions";
import { getPrisma } from "@/lib/prisma";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCsrfCookie } from "@/lib/auth/csrf";
import { generateSessionToken } from "@/lib/auth/tokens";
import { buildAuthAuditRecord } from "@/lib/auth-domain/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ challengeToken: z.string().min(20), code: z.string().regex(/^\d{6}$/).optional(), recoveryCode: z.string().min(8).max(64).optional(), purpose: z.enum(["ELEVATION","LOGIN","DISABLE"]).default("ELEVATION") }).strict().refine(d => !!d.code !== !!d.recoveryCode, { message: "Provide code or recoveryCode" });
function json(body: unknown, status = 200, headers?: Headers) { const h = new Headers(headers); h.set("Cache-Control","private, no-store"); h.set("Referrer-Policy","no-referrer"); h.set("X-Content-Type-Options","nosniff"); return Response.json(body, { status, headers: h }); }
function key(s: string) { return createHash("sha256").update(`swiftmc:mfa:${s}`).digest("hex"); }

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  if (!hasExactOrigin(request.headers, String(env.APP_URL ?? "")) || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) return json({ error: { code: "ORIGIN_REJECTED", message: "Origem não permitida." } }, 403);
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  let body: unknown; try { body = await request.json(); } catch { return json({ error: { code: "INVALID", message: "Dados inválidos." } }, 400); }
  const input = schema.safeParse(body); if (!input.success) return json({ error: { code: "INVALID", message: "Dados inválidos." } }, 400);
  const rl = createRateLimiter(env); const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try { if (!(await rl.check({ key: key(`verify:user:${auth.user.id}`) })) || !(await rl.check({ key: key(`verify:ip:${ip}`) }))) return rateLimitResponse(); } catch { return rateLimitResponse(); }
  const verified = await verifyMfaChallenge({ env, challengeToken: input.data.challengeToken, code: input.data.code, recoveryCode: input.data.recoveryCode, purpose: input.data.purpose, requestId: crypto.randomUUID(), userId: auth.user.id, expectedSessionId: input.data.purpose === "ELEVATION" || input.data.purpose === "LOGIN" ? auth.sessionId : auth.sessionId });
  if (!verified.ok) return json({ error: { code: verified.code, message: "Verificação MFA inválida." } }, 403);
  if (input.data.purpose === "DISABLE") {
    return json({ ok: true, elevated: false, verifiedFor: "DISABLE" });
  }
  // Elevate: rotate session ID and mark MFA verified; keep user/authVersion, enforce admin policy.
  return withAuthServices(env, async (services) => {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!user || user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
    await services.sessionService.revokeSession(auth.sessionId);
    const issued = await services.sessionService.issueSession({ userId: user.id, authVersion: user.authVersion, rememberMe: false, isPrivilegedAdmin: user.role === "ADMIN" || user.role === "OWNER", mfaVerifiedAt: new Date() });
    if (!issued.ok) return json({ error: { code: "REQUEST_FAILED", message: "Falha ao elevar sessão." } }, 400);
    await prisma.authAuditEvent.create({ data: buildAuthAuditRecord({ eventType: "ADMIN_ELEVATION_GRANTED", outcome: "success", requestId: crypto.randomUUID(), actorUserId: user.id, subjectUserId: user.id }) });
    const headers = new Headers();
    setSessionCookie(headers, issued.rawToken, issued.session.absoluteExpiresAt);
    setCsrfCookie(headers, generateSessionToken());
    return json({ ok: true, elevated: true }, 200, headers);
  });
}
