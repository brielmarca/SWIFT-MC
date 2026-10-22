import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SECURITY_TOKEN_PURPOSES = Object.freeze([
  "csrf", "oauth-state", "email-register", "email-verify", "email-change", "password-reset",
] as const);
export type SecurityTokenPurpose = typeof SECURITY_TOKEN_PURPOSES[number];

/** Tokens are bearer secrets: never log them or include them in audit metadata. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) &&
    Buffer.from(token, "base64url").toString("base64url") === token;
}

function digest(token: string, purpose: string): string {
  if (!isValidToken(token)) throw new TypeError("Invalid security token");
  return createHash("sha256").update(`swiftmc:auth:v1:${purpose}\0`, "utf8")
    .update(Buffer.from(token, "base64url")).digest("hex");
}

export function digestSessionToken(token: string): string {
  return digest(token, "session");
}

function validatePurpose(purpose: SecurityTokenPurpose): void {
  if (!SECURITY_TOKEN_PURPOSES.includes(purpose)) throw new TypeError("Invalid token purpose");
}

export function generateSecurityToken(purpose: SecurityTokenPurpose): string {
  validatePurpose(purpose);
  return generateSessionToken();
}

export function digestSecurityToken(token: string, purpose: SecurityTokenPurpose): string {
  validatePurpose(purpose);
  return digest(token, purpose);
}

export function tokenDigestsEqual(left: string, right: string): boolean {
  if (typeof left !== "string" || typeof right !== "string" || !/^[a-f0-9]{64}$/.test(left) || !/^[a-f0-9]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
