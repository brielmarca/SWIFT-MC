import "server-only";
import { isValidToken } from "./tokens";
import { SESSION_POLICY } from "./session-policy";

export const SESSION_COOKIE_NAME = "__Host-swiftmc_session";
const ATTRIBUTES = "Path=/; HttpOnly; Secure; SameSite=Lax";

/** Call in a Route Handler before streaming. Expiry must not exceed the server session expiry. */
export function serializeSessionCookie(token: string, expiresAt: Date, now: Date = new Date()): string {
  if (!isValidToken(token)) throw new TypeError("Invalid session token");
  const maxAge = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
  if (!Number.isSafeInteger(maxAge) || maxAge <= 0 || maxAge > SESSION_POLICY.rememberMeAbsoluteSeconds) {
    throw new RangeError("Invalid session cookie expiry");
  }
  return `${SESSION_COOKIE_NAME}=${token}; ${ATTRIBUTES}; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}`;
}

export function serializeSessionCookieDeletion(): string {
  return `${SESSION_COOKIE_NAME}=; ${ATTRIBUTES}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function setSessionCookie(headers: Headers, token: string, expiresAt: Date, now: Date = new Date()): void {
  headers.append("Set-Cookie", serializeSessionCookie(token, expiresAt, now));
}

export function clearSessionCookie(headers: Headers): void {
  headers.append("Set-Cookie", serializeSessionCookieDeletion());
}
