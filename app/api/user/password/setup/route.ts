import "server-only";
import { createHash } from "node:crypto";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { InitialPasswordRequestSchema } from "@/lib/auth-domain/dto";
import { hashPassword, isPasswordPolicyValid } from "@/lib/auth/password";
import { SESSION_POLICY } from "@/lib/auth/session-policy";
import { AUTH_AUDIT_EVENTS } from "@/lib/auth-domain/audit";
import { RollbackRequiredError } from "@/lib/auth-domain/errors";
import type { PrismaClient } from "@prisma/client";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, {
    status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}

function opaqueKey(input: string): string {
  return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\\0${input}`).digest("hex");
}

/**
 * Set a first password on an existing Discord account.
 * Requires a recently authenticated session and a verified email.
 * Never replaces an existing credential and never unlinks Discord.
 */
export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;
  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) {
    return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  }
  const csrf = requireCsrfToken(request);
  if (csrf) return csrf;

  const limiter = createRateLimiter(env);
  try {
    if (!(await limiter.check({ key: opaqueKey(`auth:user:password-setup:${auth.user.id}`) }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError("REQUEST_FAILED", "Corpo inválido.", 400); }
  const parsed = InitialPasswordRequestSchema.safeParse(body);
  if (!parsed.success || !isPasswordPolicyValid(parsed.data.newPassword)) {
    return jsonError("REQUEST_FAILED", "Use uma senha de ao menos 12 caracteres e confirme-a corretamente.", 400);
  }

  // Derive the password hash before acquiring the transactional user lock.
  const passwordHash = await hashPassword(parsed.data.newPassword);
  const requestId = crypto.randomUUID();
  try {
    return await withAuthTransaction(env, async services => {
      const prisma = (services.repositories.userRepository as unknown as { prisma: PrismaClient }).prisma;

      // Serializes password setup for the same user and avoids concurrent first-password writes.
      const locked = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "User" WHERE "id" = ${auth.user.id} FOR UPDATE
      `;
      if (locked.length !== 1) return jsonError("REQUEST_FAILED", "Conta indisponível.", 403);
      const user = await services.repositories.userRepository.findById(auth.user.id);
      if (!user || user.status !== "ACTIVE") return jsonError("REQUEST_FAILED", "Conta indisponível.", 403);
      if (!user.emailNormalized || !user.emailVerifiedAt) {
        return jsonError("EMAIL_NOT_VERIFIED", "Verifique seu e-mail antes de criar uma senha.", 403);
      }
      const discord = await services.repositories.identityRepository.findByUserAndProvider(user.id, "DISCORD");
      if (!discord) return jsonError("REQUEST_FAILED", "Esta opção é exclusiva de contas vinculadas ao Discord.", 403);
      const existing = await services.repositories.identityRepository.findByUserAndProvider(user.id, "EMAIL_PASSWORD");
      if (existing) return jsonError("PASSWORD_ALREADY_EXISTS", "Esta conta já possui senha. Use a opção de alterar senha.", 409);

      const session = await prisma.session.findUnique({
        where: { id: auth.sessionId },
        select: { userId: true, authenticatedAt: true, revokedAt: true, authVersion: true },
      });
      const age = session ? Date.now() - new Date(session.authenticatedAt).getTime() : NaN;
      if (!session || session.userId !== user.id || session.revokedAt ||
        session.authVersion !== user.authVersion ||
        !Number.isFinite(age) || age < 0 || age > SESSION_POLICY.recentAuthenticationSeconds * 1000) {
        return jsonError("RECENT_AUTH_REQUIRED", "Entre novamente pelo Discord e tente em até 10 minutos.", 403);
      }

      // All mutations use the same transaction; any post-write failure throws to roll back.
      const identity = await services.repositories.identityRepository.createIdentity({
        userId: user.id, provider: "EMAIL_PASSWORD", providerSubject: user.emailNormalized, createdAt: new Date(),
      });
      await services.repositories.passwordCredentialRepository.createPasswordHash(identity.id, passwordHash);
      if (!(await services.repositories.userRepository.bumpAuthVersion(user.id, user.authVersion))) {
        throw new RollbackRequiredError("SETUP_FAILED", "AUTH_VERSION_MISMATCH");
      }
      await services.sessionService.revokeAllUserSessions(user.id);
      await services.repositories.emailChallengeRepository.invalidateOutstanding(user.emailNormalized, "PASSWORD_RESET");
      await services.repositories.auditRepository.append({
        eventType: AUTH_AUDIT_EVENTS.PASSWORD_CREATED,
        outcome: "success",
        requestId,
        actorUserId: user.id,
        subjectUserId: user.id,
        metadata: { provider: "EMAIL_PASSWORD" },
      });
      return Response.json({
        ok: true,
        message: "Senha criada com sucesso. Entre novamente com Discord ou e-mail e senha.",
      }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    });
  } catch (error) {
    if (error instanceof RollbackRequiredError) {
      return jsonError("REQUEST_FAILED", "Não foi possível criar a senha.", 409);
    }
    console.error("initial-password-setup-failed", { requestId });
    return jsonError("REQUEST_FAILED", "Não foi possível criar a senha.", 500);
  }
}
