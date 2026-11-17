import "server-only";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

export type TurnstileAction = "register" | "login" | "forgot";

type TurnstileEnv = Pick<AuthBindings, "TURNSTILE_ENABLED" | "TURNSTILE_SITE_KEY" | "TURNSTILE_SECRET_KEY"> & {
  APP_URL?: string;
  APP_ENV?: string;
};

type SiteverifyResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
};

function captchaError(code: string, message: string, status: number): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
  );
}

/** Keep existing strict auth DTOs intact: Turnstile is transport metadata, not a domain field. */
export function withoutTurnstileToken(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const clean = { ...body } as Record<string, unknown>;
  delete clean.turnstileToken;
  return clean;
}

export async function requireTurnstile(
  request: Request,
  body: unknown,
  env: TurnstileEnv,
  actions: readonly TurnstileAction[],
): Promise<Response | null> {
  if (env.TURNSTILE_ENABLED !== "true") return null;

  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = env.TURNSTILE_SITE_KEY?.trim();
  let expectedHost = "";
  try { expectedHost = new URL(env.APP_URL ?? "").hostname.toLowerCase(); } catch { /* misconfigured */ }
  const productionHost = expectedHost === "swiftmc.com.br" || expectedHost === "www.swiftmc.com.br";
  if (!secret || !siteKey || !expectedHost ||
      ((env.APP_ENV === "production" || productionHost) && /^[123]x0{8,}/.test(secret))) {
    return captchaError("CAPTCHA_UNAVAILABLE", "Verificação humana temporariamente indisponível.", 503);
  }

  const rawToken = (body && typeof body === "object" && !Array.isArray(body))
    ? (body as Record<string, unknown>).turnstileToken : null;
  if (typeof rawToken !== "string" || rawToken.length < 1 || rawToken.length > 2048) {
    return captchaError("CAPTCHA_REQUIRED", "Conclua a verificação humana e tente novamente.", 403);
  }

  const form = new URLSearchParams({ secret, response: rawToken });
  const clientIp = request.headers.get("cf-connecting-ip");
  if (clientIp) form.set("remoteip", clientIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) {
      return captchaError("CAPTCHA_UNAVAILABLE", "Verificação humana temporariamente indisponível.", 503);
    }
    const result = await response.json() as SiteverifyResponse;
    if (result.success !== true ||
        typeof result.hostname !== "string" || result.hostname.toLowerCase() !== expectedHost ||
        typeof result.action !== "string" || !actions.includes(result.action as TurnstileAction)) {
      return captchaError("CAPTCHA_FAILED", "Verificação humana inválida ou expirada. Tente novamente.", 403);
    }
    return null;
  } catch {
    return captchaError("CAPTCHA_UNAVAILABLE", "Verificação humana temporariamente indisponível.", 503);
  }
}
