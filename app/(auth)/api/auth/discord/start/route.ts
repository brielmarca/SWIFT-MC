import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthServices } from "@/lib/auth-api/auth-stack";
import { hasExactOrigin, internalReturnPath } from "@/lib/auth/browser-security";
import { requireCsrfToken, getOptionalSession } from "@/lib/auth/middleware";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import { generateSecurityToken, digestSecurityToken } from "@/lib/auth/tokens";
import { buildDiscordAuthorizeUrl, discordConfigured, encryptSecret, pkceChallenge, pkceVerifier } from "@/lib/auth/discord-oauth";
import { createHash } from "node:crypto";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  if (!env.AUTH_HYPERDRIVE) return jsonError("REQUEST_FAILED", "Authentication infrastructure unavailable.", 503);
  const trustedOrigin = (env.APP_URL as string) || "";
  if (!hasExactOrigin(request.headers, trustedOrigin)) return jsonError("ORIGIN_REJECTED", "Request origin not trusted.", 403);
  const csrfError = requireCsrfToken(request); if (csrfError) return csrfError;
  if (!discordConfigured(env)) return jsonError("REQUEST_FAILED", "Discord login is not configured.", 503);

  const rateLimiter = createRateLimiter(env as Pick<AuthBindings, "AUTH_RATE_LIMIT">);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try {
    const key = createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0oauth:start:ip:${ip}`).digest("hex");
    if (!(await rateLimiter.check({ key }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }

  let body: { returnPath?: string; intent?: string } = {};
  try { body = await request.json() as typeof body; } catch { /* ignore */ }
  const intent = body.intent === "LINK" ? "LINK" : "LOGIN";
  const returnPath = internalReturnPath(body.returnPath || "/account") || "/account";
  const session = await getOptionalSession(request, env);
  if (intent === "LINK" && !session) return jsonError("UNAUTHENTICATED", "Sessão inválida ou expirada.", 401);

  const state = generateSecurityToken("oauth-state");
  const verifier = pkceVerifier();
  const browserToken = generateSecurityToken("csrf");
  const now = Date.now();
  const expires = new Date(now + 10 * 60 * 1000);

  try {
    return await withAuthServices(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (services) => {
      const repos = services.repositories;
      const ctx = await repos.browserContextRepository.create({
        tokenHash: digestSecurityToken(browserToken, "csrf"),
        csrfTokenHash: digestSecurityToken(browserToken, "csrf"),
        expiresAt: expires,
      });
      await repos.oauthTransactionRepository.create({
        stateHash: digestSecurityToken(state, "oauth-state"),
        browserContextId: ctx.id,
        intent,
        linkUserId: intent === "LINK" ? session!.user.id : null,
        initiatingSessionId: intent === "LINK" ? session!.sessionId : null,
        pkceVerifierCiphertext: encryptSecret(env, verifier),
        returnPath,
        expiresAt: expires,
      });
      const url = buildDiscordAuthorizeUrl(env as { DISCORD_CLIENT_ID: string; DISCORD_REDIRECT_URI: string }, { state, codeChallenge: pkceChallenge(verifier) });
      const headers = new Headers({ "Cache-Control": "private, no-store" });
      headers.append("Set-Cookie", `__Host-swiftmc_oauth=${browserToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      return Response.json({ ok: true, url }, { status: 200, headers });
    });
  } catch {
    return jsonError("REQUEST_FAILED", "Não foi possível iniciar o login com Discord.", 400);
  }
}
