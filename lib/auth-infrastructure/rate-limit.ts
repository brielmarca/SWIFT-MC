import "server-only";
import type { AuthBindings } from "./bindings";

export type RateLimitScope = "login:email" | "login:email+ip" | "auth:user" | "auth:challenge";

export interface RateLimiter {
  check(params: { key: string }): Promise<boolean>;
}

/**
 * Rate limiter backed by Cloudflare's Rate Limit binding.
 * Fail-closed: if the binding is not configured, all checks return false
 * (request rejected), ensuring rate limiting is never silently bypassed.
 */
export class CloudflareRateLimiter implements RateLimiter {
  private readonly rateLimit: AuthBindings["AUTH_RATE_LIMIT"];

  constructor(rateLimit: AuthBindings["AUTH_RATE_LIMIT"]) {
    if (!rateLimit) {
      throw new Error("AUTH_RATE_LIMIT binding is required for rate limiting");
    }
    this.rateLimit = rateLimit;
  }

  async check(params: { key: string }): Promise<boolean> {
    const result = await this.rateLimit!.limit({ key: params.key });
    return result.success === true;
  }
}

/**
 * No-op rate limiter that rejects all requests. Used when the binding is
 * absent to enforce fail-closed behavior.
 */
export class RejectingRateLimiter implements RateLimiter {
  async check(params: { key: string }): Promise<boolean> {
    void params;
    return false;
  }
}

export function createRateLimiter(env: Pick<AuthBindings, "AUTH_RATE_LIMIT">): RateLimiter {
  if (!env.AUTH_RATE_LIMIT) {
    return new RejectingRateLimiter();
  }
  return new CloudflareRateLimiter(env.AUTH_RATE_LIMIT);
}

export function rateLimitHeaders(retryAfterSeconds = 60): HeadersInit {
  return {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Retry-After": String(retryAfterSeconds),
  };
}

export function rateLimitResponse(code: string = "RATE_LIMITED"): Response {
  return Response.json(
    { error: { code, message: "Muitas tentativas. Tente novamente mais tarde." } },
    { status: 429, headers: rateLimitHeaders() },
  );
}
