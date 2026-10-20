import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const scryptParameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function derive(input: Buffer, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(input, salt, 32, scryptParameters, (error, key) => error ? reject(error) : resolve(key));
  });
}

function memory() {
  try {
    const { rss, heapUsed, external } = process.memoryUsage();
    return { rss, heapUsed, external };
  } catch { return null; }
}

/** Staging only: one hash, one verification, and exactly two concurrent hashes. */
export async function stagingScryptProbe() {
  const input = Buffer.from("SwiftMC infrastructure probe - not a credential", "utf8");
  const salt = randomBytes(16);
  try {
    let start = performance.now();
    const reference = await derive(input, salt);
    const singleHashMs = performance.now() - start;
    start = performance.now();
    const verified = timingSafeEqual(reference, await derive(input, salt));
    const verificationMs = performance.now() - start;
    start = performance.now();
    await Promise.all([derive(input, randomBytes(16)), derive(input, randomBytes(16))]);
    return { singleHashMs, verificationMs, concurrencyTwoMs: performance.now() - start, verified };
  } finally {
    input.fill(0);
  }
}

/** Fixed, bounded work only. Inputs, keys and derived values never leave this function. */
export async function cryptoProbe() {
  const input = randomBytes(32);
  const salt = randomBytes(16);
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("swiftmc-phase-a"));
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const decrypt = (tag: Buffer) => {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from("swiftmc-phase-a"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  };
  const tag = cipher.getAuthTag();
  const aesGcm = timingSafeEqual(input, decrypt(tag));
  const tampered = Buffer.from(tag);
  tampered[0] ^= 1;
  let rejectsTampering = false;
  try { decrypt(tampered); } catch { rejectsTampering = true; }
  const primitives = {
    randomBytes: input.length === 32 && !input.equals(randomBytes(32)),
    sha256: createHash("sha256").update("abc").digest("hex") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    hmacSha256: createHmac("sha256", "key").update("The quick brown fox jumps over the lazy dog").digest("hex") === "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8",
    timingSafeEqual: timingSafeEqual(input, Buffer.from(input)) && !timingSafeEqual(input, randomBytes(32)),
    aesGcm, rejectsTampering,
  };
  const before = memory();
  const sequentialMs: number[] = [];
  try {
    let reference: Buffer | undefined;
    let verification = true;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      const result = await derive(input, salt);
      sequentialMs.push(performance.now() - start);
      if (reference) verification &&= timingSafeEqual(reference, result);
      reference = result;
    }
    const start = performance.now();
    const concurrent = await Promise.all([derive(input, randomBytes(16)), derive(input, randomBytes(16))]);
    const concurrencyTwoMs = performance.now() - start;
    verification &&= !timingSafeEqual(concurrent[0], concurrent[1]);
    return { primitives, scrypt: { accepted: true, parameters: scryptParameters, sequentialMs, averageMs: sequentialMs.reduce((a, b) => a + b, 0) / 3, concurrencyTwoMs, verification }, memory: { before, after: memory() } };
  } catch (error) {
    return { primitives, scrypt: { accepted: false, parameters: scryptParameters, sequentialMs, error: error instanceof Error ? error.message : "unsupported" }, memory: { before, after: memory() } };
  } finally {
    input.fill(0); key.fill(0);
  }
}
