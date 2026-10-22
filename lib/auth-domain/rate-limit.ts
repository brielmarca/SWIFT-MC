import "server-only";
import { createHmac } from "node:crypto";

export type LimiterPurpose = "login:email" | "login:email+ip" | "auth:user" | "auth:challenge";

/**
 * Server-only rate-limit identifier helpers using an injected HMAC key.
 *
 * Derives opaque, domain-separated identifiers so that:
 *   - raw email never appears in the generated limiter key (it is HMAC'd)
 *   - keys for different purposes cannot collide (purpose is domain-separated)
 *   - arbitrary X-Forwarded-For is not trusted (client IP comes from a trusted source)
 *
 * No actual Cloudflare rate limiting is performed here; this only derives keys
 * for a future rate-limiting integration.
 */

export function deriveLimiterKey(params: {
  hmacKey: string;
  purpose: LimiterPurpose;
  normalizedEmail?: string;
  clientIp?: string;
  userId?: string;
  challengeId?: string;
}): string {
  const hmac = createHmac("sha256", params.hmacKey);
  hmac.update("swiftmc:auth:ratelimit:v1\0", "utf8");
  hmac.update(`purpose:${params.purpose}\0`, "utf8");

  if (params.normalizedEmail !== undefined) {
    hmac.update(`email:${params.normalizedEmail}\0`, "utf8");
  }
  if (params.clientIp !== undefined) {
    hmac.update(`ip:${params.clientIp}\0`, "utf8");
  }
  if (params.userId !== undefined) {
    hmac.update(`user:${params.userId}\0`, "utf8");
  }
  if (params.challengeId !== undefined) {
    hmac.update(`challenge:${params.challengeId}\0`, "utf8");
  }

  return hmac.digest("hex");
}

export function limiterKeyForEmail(hmacKey: string, normalizedEmail: string): string {
  return deriveLimiterKey({ hmacKey, purpose: "login:email", normalizedEmail });
}

export function limiterKeyForEmailAndIp(hmacKey: string, normalizedEmail: string, clientIp: string): string {
  return deriveLimiterKey({ hmacKey, purpose: "login:email+ip", normalizedEmail, clientIp });
}

export function limiterKeyForUser(hmacKey: string, userId: string): string {
  return deriveLimiterKey({ hmacKey, purpose: "auth:user", userId });
}

export function limiterKeyForChallenge(hmacKey: string, challengeId: string): string {
  return deriveLimiterKey({ hmacKey, purpose: "auth:challenge", challengeId });
}
