import "server-only";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { requireSession, requireCsrfToken } from "@/lib/auth/middleware";
import { hasTrustedBrowserMutation } from "@/lib/auth/browser-security";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { isRollbackRequiredError } from "@/lib/auth-domain/errors";
import { PasswordChangeRequestSchema } from "@/lib/auth-domain/dto";
import { createHash } from "node:crypto";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  const auth = await requireSession(request, env);
  if (auth instanceof Response) return auth;

  if (!hasTrustedBrowserMutation(request.headers, env.APP_URL ?? "")) {
    return jsonError("ORIGIN_REJECTED", "Origem não permitida.", 403);
  }

  // CSRF protection for state-changing POST
  const csrfError = requireCsrfToken(request);
  if (csrfError) return csrfError;

  const { user } = auth;

  // Rate limit password change by user ID. Fail-closed.
  const rateLimiter = createRateLimiter(env);
  try {
    const userKey = opaqueKey(`auth:user:password-change:${user.id}`);
    if (!(await rateLimiter.check({ key: userKey }))) {
      return rateLimitResponse();
    }
  } catch {
    return rateLimitResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("REQUEST_FAILED", "Corpo da requisição inválido.", 400);
  }

  const input = PasswordChangeRequestSchema.safeParse(body);
  if (!input.success) {
    return jsonError("REQUEST_FAILED", "Dados inválidos.", 400);
  }

  const { currentPassword, newPassword } = input.data;
  const email = user.emailNormalized;

  // Reject reuse of the current password before opening the mutation transaction.
  if (currentPassword === newPassword) {
    return jsonError("REQUEST_FAILED", "A nova senha deve ser diferente da atual.", 400);
  }
  if (!email) {
    return jsonError("REQUEST_FAILED", "Não foi possível alterar a senha.", 400);
  }

  const requestId = crypto.randomUUID();

  try {
    // Single authoritative mutation: the domain flow verifies the current
    // credential, replaces the hash conditionally, increments authVersion,
    // revokes every session and invalidates outstanding password-reset
    // challenges inside one transaction.
    return await withAuthTransaction(env, async (services) => {
      const result = await services.loginService.changePassword({
        email,
        currentPassword,
        newPassword,
        requestId,
      });

      if (!result.ok) {
        return jsonError("REQUEST_FAILED", "Não foi possível alterar a senha.", 400);
      }

      return Response.json({
        ok: true,
        message: "Senha alterada com sucesso. Todas as sessões foram encerradas.",
      }, {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      });
    });
  } catch (error) {
    // RollbackRequiredError means the transaction already rolled back a partial
    // mutation: report the same generic failure, never success. Any other error
    // (including infrastructure failures) stays a server error.
    if (isRollbackRequiredError(error)) {
      return jsonError("REQUEST_FAILED", "Não foi possível alterar a senha.", 400);
    }
    return jsonError("REQUEST_FAILED", "Não foi possível alterar a senha.", 500);
  }
}

function opaqueKey(input: string): string {
  return createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0${input}`).digest("hex");
}
