import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const CSRF_COOKIE_NAME = "__Host-swiftmc_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generates a CSRF token (32 random bytes, base64url encoded).
 * Never stored in plaintext; only the digest is persisted.
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Digests a CSRF token for secure storage (SHA-256 with domain separation).
 */
export function digestCsrfToken(token: string): string {
  return createHash("sha256").update(`swiftmc:auth:v1:csrf\0${token}`).digest("hex");
}

/**
 * Compares a CSRF token against its stored digest using constant-time comparison.
 */
export function csrfTokenMatches(token: string, digest: string): boolean {
  if (typeof token !== "string" || typeof digest !== "string") return false;
  const expected = digestCsrfToken(token);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(digest, "hex"));
}

/**
 * Cookie attributes for the CSRF token cookie.
 * Not HttpOnly so the client can read it and send it as a custom header
 * (double-submit cookie pattern).
 * Secure + SameSite=Lax to prevent CSRF.
 */
export const CSRF_COOKIE_ATTRIBUTES = "Path=/; Secure; SameSite=Lax";

/**
 * Serializes the CSRF token cookie.
 */
export function serializeCsrfCookie(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}; ${CSRF_COOKIE_ATTRIBUTES}; Max-Age=${86400 * 30}`;
}

/**
 * Serializes CSRF cookie deletion.
 */
export function serializeCsrfCookieDeletion(): string {
  return `${CSRF_COOKIE_NAME}=; ${CSRF_COOKIE_ATTRIBUTES}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Extracts the CSRF token from a Cookie header.
 */
export function extractCsrfTokenFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  return cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=") ?? null;
}

/**
 * Extracts the CSRF token from a request's custom header.
 */
export function extractCsrfTokenFromHeader(headers: Headers): string | null {
  return headers.get(CSRF_HEADER_NAME) ?? null;
}

/**
 * Sets the CSRF cookie on a response.
 */
export function setCsrfCookie(headers: Headers, token: string): void {
  headers.append("Set-Cookie", serializeCsrfCookie(token));
}

/**
 * Clears the CSRF cookie.
 */
export function clearCsrfCookie(headers: Headers): void {
  headers.append("Set-Cookie", serializeCsrfCookieDeletion());
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
