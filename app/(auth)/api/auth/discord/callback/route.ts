import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthTransaction } from "@/lib/auth-api/auth-stack";
import { setSessionCookie } from "@/lib/auth/cookies";
import { setCsrfCookie } from "@/lib/auth/csrf";
import { generateSessionToken, digestSecurityToken } from "@/lib/auth/tokens";
import { internalReturnPath } from "@/lib/auth/browser-security";
import { decryptSecret, discordConfigured, exchangeDiscordCode, fetchDiscordUser } from "@/lib/auth/discord-oauth";

import { createHash } from "node:crypto";
import { createRateLimiter, rateLimitResponse } from "@/lib/auth-infrastructure/rate-limit";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";
import type { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirect(to: string, headers = new Headers()): Response {
  headers.set("Location", to);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(null, { status: 302, headers });
}
function fail(code = "oauth_failed") { return redirect(`/login?error=${encodeURIComponent(code)}`); }

export async function GET(request: Request): Promise<Response> {
  const env = await getWorkersEnv();
  if (!env.AUTH_HYPERDRIVE || !discordConfigured(env)) return fail();
  const rateLimiter = createRateLimiter(env as Pick<AuthBindings, "AUTH_RATE_LIMIT">);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try {
    const key = createHash("sha256").update(`swiftmc:auth:ratelimit:v1\0oauth:callback:ip:${ip}`).digest("hex");
    if (!(await rateLimiter.check({ key }))) return rateLimitResponse();
  } catch { return rateLimitResponse(); }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail();
  const cookie = request.headers.get("cookie") || "";
  const browserToken = cookie.split(";").map(c=>c.trim()).find(c=>c.startsWith("__Host-swiftmc_oauth="))?.split("=").slice(1).join("=");
  if (!browserToken) return fail("oauth_context");

  try {
    return await withAuthTransaction(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (services) => {
      const repos = services.repositories as unknown as {
        browserContextRepository: { consume: (h: string) => Promise<{ id: string } | null> };
        oauthTransactionRepository: { consume: (h: string) => Promise<{ browserContextId: string; intent: string; linkUserId: string | null; pkceVerifierCiphertext: string; returnPath: string } | null> };
        identityRepository: { findByProviderAndSubject: (p: string, s: string) => Promise<{ userId: string } | null>; createIdentity: (p: { userId: string; provider: "DISCORD"; providerSubject: string; createdAt: Date }) => Promise<unknown> };
        userRepository: { findById: (id: string) => Promise<{ id: string; role: string; status: string; authVersion: number } | null>; createUser: (p: { emailNormalized: string | null; displayName: string; role: string; status: string; authVersion: number; emailVerifiedAt: Date | null; createdAt: Date; updatedAt: Date }) => Promise<{ id: string; role: string; status: string; authVersion: number }> };
      };
      const browser = await repos.browserContextRepository.consume(digestSecurityToken(browserToken, "csrf"));
      if (!browser) return fail("oauth_context");
      const tx = await repos.oauthTransactionRepository.consume(digestSecurityToken(state, "oauth-state"));
      if (!tx || tx.browserContextId !== browser.id) return fail("oauth_state");
      const verifier = decryptSecret(env, tx.pkceVerifierCiphertext);
      const token = await exchangeDiscordCode(env as { DISCORD_CLIENT_ID: string; DISCORD_CLIENT_SECRET: string; DISCORD_REDIRECT_URI: string }, { code, codeVerifier: verifier });
      const discordUser = await fetchDiscordUser(token.access_token);
      const subject = discordUser.id;

      const existingIdentity = await repos.identityRepository.findByProviderAndSubject("DISCORD", subject);
      let userId: string; let user: { id: string; role: string; status: string; authVersion: number };
      if (tx.intent === "LINK") {
        if (!tx.linkUserId) return fail("oauth_link");
        if (existingIdentity && existingIdentity.userId !== tx.linkUserId) return fail("oauth_link_conflict");
        const target = await repos.userRepository.findById(tx.linkUserId);
        if (!target || target.status !== "ACTIVE") return fail("oauth_link");
        user = target; userId = target.id;
        if (!existingIdentity) await repos.identityRepository.createIdentity({ userId, provider: "DISCORD", providerSubject: subject, createdAt: new Date() });
      } else {
        if (existingIdentity) {
          const found = await repos.userRepository.findById(existingIdentity.userId);
          if (!found || found.status !== "ACTIVE") return fail("oauth_account");
          user = found; userId = found.id;
        } else {
          const displayName = (discordUser.global_name || discordUser.username || "Discord User").slice(0, 100);
          user = await repos.userRepository.createUser({ emailNormalized: null, displayName, role: "USER", status: "ACTIVE", authVersion: 1, emailVerifiedAt: null, createdAt: new Date(), updatedAt: new Date() });
          userId = user.id;
          await repos.identityRepository.createIdentity({ userId, provider: "DISCORD", providerSubject: subject, createdAt: new Date() });
        }
      }

      const txClient = (repos.userRepository as unknown as { prisma: PrismaClient }).prisma;
      if (txClient.provisionedAdmin) {
        const claim = await txClient.provisionedAdmin.findUnique({ where: { discordSubject: subject } });
        if (claim && !claim.claimedByUserId && !claim.consumedAt) {
          try {
            const now = new Date();
            const claimed = await txClient.provisionedAdmin.updateMany({
              where: { id: claim.id, claimedByUserId: null, consumedAt: null },
              data: { claimedByUserId: userId, claimedAt: now, consumedAt: now },
            });
            if (claimed.count === 1) {
              const refreshed = await repos.userRepository.findById(userId);
              if (refreshed) user = refreshed;
              try {
                await txClient.authAuditEvent.create({
                  data: {
                    eventType: "ADMIN_PROVISIONING_CLAIMED",
                    outcome: "success",
                    requestId: crypto.randomUUID(),
                    actorUserId: userId,
                    subjectUserId: userId,
                    metadata: { reason: "PROVISIONING_CLAIMED" },
                  },
                });
              } catch { /* audit must not block secure claim completion */ }
            }
          } catch {
            // claim race, guard rejection, or already consumed: fail closed (no privilege escalation)
          }
        }
      }

      const privilegedAdmin = user.role === "ADMIN" || user.role === "OWNER";
      const mfaConfigured = Boolean((await txClient.mfaCredential.findUnique({ where: { userId }, select: { confirmedAt: true } }).catch(() => null))?.confirmedAt);
      const returnTo = internalReturnPath(tx.returnPath) || "/account";

      await services.sessionService.revokeAllUserSessions(userId);
      // Never grant MFA-verified trust from OAuth alone. Privileged/admin sessions are issued without MFA trust
      // so administrative surfaces remain unavailable until a real MFA challenge is completed.
      const issued = await services.sessionService.issueSession({
        userId,
        authVersion: user.authVersion,
        rememberMe: false,
        isPrivilegedAdmin: privilegedAdmin,
        mfaVerifiedAt: null,
      });
      if (!issued.ok) return fail();
      const headers = new Headers();
      setSessionCookie(headers, issued.rawToken, issued.session.absoluteExpiresAt);
      setCsrfCookie(headers, generateSessionToken());
      headers.append("Set-Cookie", "__Host-swiftmc_oauth=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
      if (privilegedAdmin || mfaConfigured) {
        const next = mfaConfigured ? `/admin/login?callbackUrl=${encodeURIComponent(returnTo.startsWith("/admin") ? returnTo : "/admin")}` : "/admin/security";
        return redirect(next, headers);
      }
      return redirect(returnTo, headers);
    });
  } catch {
    return fail();
  }
}
