import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const PASSWORD_MAX_BYTES = 1024;
const PREFIX = "$swiftmc$scrypt$v=1$N=32768,r=8,p=3$";
const FORMAT = /^\$swiftmc\$scrypt\$v=1\$N=32768,r=8,p=3\$([A-Za-z0-9_-]{22})\$([A-Za-z0-9_-]{43})$/;

function validPassword(password: unknown): password is string {
  return typeof password === "string" && password.length > 0 &&
    password.length <= PASSWORD_MAX_BYTES && Buffer.byteLength(password, "utf8") <= PASSWORD_MAX_BYTES &&
    // Reject unpaired surrogates rather than silently replacing them during UTF-8 encoding.
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(password);
}

function parseHash(encoded: unknown): { salt: Buffer; key: Buffer } | null {
  if (typeof encoded !== "string" || encoded.length > 160) return null;
  const match = FORMAT.exec(encoded);
  if (!match) return null;
  const salt = Buffer.from(match[1], "base64url");
  const key = Buffer.from(match[2], "base64url");
  if (salt.length !== 16 || key.length !== 32 || salt.toString("base64url") !== match[1] || key.toString("base64url") !== match[2]) return null;
  return { salt, key };
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** No trimming, truncation or Unicode normalization. Enrollment strength rules belong to future services. */
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new TypeError("Invalid password input");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  try {
    return `${PREFIX}${salt.toString("base64url")}$${key.toString("base64url")}`;
  } finally {
    key.fill(0);
  }
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  if (!validPassword(password)) return false;
  const parsed = parseHash(encodedHash);
  if (!parsed) return false;
  const candidate = await derive(password, parsed.salt);
  try {
    return timingSafeEqual(candidate, parsed.key);
  } finally {
    candidate.fill(0);
    parsed.key.fill(0);
  }
}

/** Unknown/invalid formats require intervention; never rehash without successful authentication. */
export function passwordHashNeedsUpgrade(encodedHash: string): boolean {
  return parseHash(encodedHash) === null;
}
