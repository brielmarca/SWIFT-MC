import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { digestSecurityToken, generateSecurityToken } from "@/lib/auth/tokens";

const PERIOD = 30;
const DIGITS = 6;
export const TOTP_STEP_SECONDS = PERIOD;
export const TOTP_DIGITS = DIGITS;

function keyFrom(env: { AUTH_ENCRYPTION_KEY?: string }): Buffer {
  const raw = env.AUTH_ENCRYPTION_KEY || "";
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  try { const b = Buffer.from(raw, "base64"); if (b.length === 32) return b; } catch { /* try next encoding */ }
  try { const b = Buffer.from(raw, "base64url"); if (b.length === 32) return b; } catch { /* invalid key */ }
  throw new Error("AUTH_ENCRYPTION_KEY must be 32 bytes");
}

export function encryptMfaSecret(env: { AUTH_ENCRYPTION_KEY?: string }, secretBase32: string): string {
  const key = keyFrom(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptMfaSecret(env: { AUTH_ENCRYPTION_KEY?: string }, ciphertext: string): string {
  const [v, ivs, tags, datas] = String(ciphertext || "").split(".");
  if (v !== "v1" || !ivs || !tags || !datas) throw new Error("Invalid MFA secret");
  const key = keyFrom(env);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivs, "base64url"));
  decipher.setAuthTag(Buffer.from(tags, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(datas, "base64url")), decipher.final()]).toString("utf8");
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  let bits = 0, value = 0, out = "";
  for (let i = 0; i < buf.length; i++) { value = (value << 8) | buf[i]!; bits += 8; while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]!; bits -= 5; } }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]!;
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0; const out: number[] = [];
  for (const c of clean) { value = (value << 5) | ALPHABET.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}

export function currentTotpStep(timeMs = Date.now()): bigint {
  return BigInt(Math.floor(timeMs / 1000 / PERIOD));
}

export function totpCode(secretBase32: string, timeMs = Date.now()): string {
  const counter = Math.floor(timeMs / 1000 / PERIOD);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Returns matched step for replay protection, or null. */
export function verifyTotpAtStep(secretBase32: string, token: string, timeMs = Date.now(), window = 1): bigint | null {
  if (!/^\d{6}$/.test(token || "")) return null;
  const step = currentTotpStep(timeMs);
  for (let w = -window; w <= window; w++) {
    const s = step + BigInt(w);
    const targetMs = Number(s) * PERIOD * 1000;
    const expected = totpCode(secretBase32, targetMs);
    const a = Buffer.from(expected); const b = Buffer.from(token);
    if (a.length === b.length && timingSafeEqual(a, b)) return s;
  }
  return null;
}

export function verifyTotp(secretBase32: string, token: string, window = 1): boolean {
  return verifyTotpAtStep(secretBase32, token, Date.now(), window) !== null;
}

export function otpauthUri(secretBase32: string, account: string, issuer = "Swift MC"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(PERIOD) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}`);
  }
  return codes;
}

export function normalizeRecoveryCode(code: string): string {
  return String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(`swiftmc:mfa:recovery:v1\0${normalizeRecoveryCode(code)}`).digest("hex");
}

export function generateMfaChallengeToken(): string {
  return generateSecurityToken("csrf").replace(/=+$/g, "");
}

export function digestMfaChallengeToken(token: string): string {
  return digestSecurityToken(token, "csrf");
}
