import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasExactOrigin } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { regenerateMfaRecoveryCodes, verifyMfaChallenge } from "@/lib/auth/mfa-service";
import { hasPermission } from "@/lib/auth/permissions";
import { verifySensitiveReauth } from "@/lib/auth/reauth";
import { getPrisma } from "@/lib/prisma";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { SESSION_POLICY } from "@/lib/auth/session-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  challengeToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().min(8).max(64).optional(),
  password: z.string().min(1).max(512).optional(),
}).strict().refine((d) => !!d.code !== !!d.recoveryCode, { message: "Provide code or recoveryCode" });

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
function key(s: string) { return createHash("sha256").update(`swiftmc:mfa:${s}`).digest("hex"); }

export async function POST(request: Request) {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env, { requiredPermission: "audit:read", requireMfa: true });
  if (auth instanceof Response) return auth;
  if (!hasExactOrigin(request.headers, String(env.APP_URL ?? "")) || (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")) {
    return json({ error: { code: "ORIGIN_REJECTED", message: "Origem não permitida." } }, 403);
  }
  const csrf = requireCsrfToken(request); if (csrf) return csrf;
  if (!hasPermission(auth.user.role, "audit:read") || auth.user.status !== "ACTIVE") return json({ error: { code: "FORBIDDEN", message: "Acesso negado." } }, 403);
  let body: unknown; try { body = await request.json(); } catch { return json({ error: { code: "INVALID", message: "Dados inválidos." } }, 400); }
  const input = schema.safeParse(body); if (!input.success) return json({ error: { code: "INVALID", message: "Dados inválidos." } }, 400);
  const rl = createRateLimiter(env); const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try {
    if (!(await rl.check({ key: key(`recovery-regen:user:${auth.user.id}`) })) || !(await rl.check({ key: key(`recovery-regen:ip:${ip}`) }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }

  const verified = await verifyMfaChallenge({ env, challengeToken: input.data.challengeToken, code: input.data.code, recoveryCode: input.data.recoveryCode, purpose: "DISABLE", requestId: crypto.randomUUID(), userId: auth.user.id, expectedSessionId: auth.sessionId });
  if (!verified.ok) return json({ error: { code: verified.code, message: "Verificação MFA inválida." } }, 403);

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({ where: { id: auth.sessionId }, select: { authenticatedAt: true } });
  const reauth = await verifySensitiveReauth({ prisma, userId: auth.user.id, password: input.data.password ?? null, sessionAuthenticatedAt: session?.authenticatedAt ?? null, recentAuthWindowMs: SESSION_POLICY.recentAuthenticationSeconds * 1000 });
  if (!reauth.ok) return json({ error: { code: reauth.reason, message: "Reautenticação segura obrigatória." } }, 403);

  return withAuthServices(env, async (services) => {
    const res = await regenerateMfaRecoveryCodes({ userId: auth.user.id, requestId: crypto.randomUUID() });
    if (!res.ok) return json({ error: { code: res.code, message: "Não foi possível regenerar códigos." } }, 400);
    // Rotation invalidates prior recovery material and revokes sessions to reduce post-compromise window.
    const bumped = await services.repositories.userRepository.bumpAuthVersion(auth.user.id, auth.user.authVersion);
    if (!bumped) return json({ error: { code: "CONFLICT", message: "Conflito de segurança. Tente novamente." } }, 409);
    await services.sessionService.revokeAllUserSessions(auth.user.id);
    const headers = new Headers();
    headers.append("Set-Cookie", "__Host-swiftmc_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
    headers.append("Set-Cookie", "__Host-swiftmc_csrf=; Path=/; Secure; SameSite=Lax; Max-Age=0");
    return json({ ok: true, recoveryCodes: res.recoveryCodes }, 200);
  });
}
