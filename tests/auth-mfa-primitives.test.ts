import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptMfaSecret, encryptMfaSecret, generateRecoveryCodes, generateTotpSecret,
  hashRecoveryCode, normalizeRecoveryCode, totpCode, verifyTotp, verifyTotpAtStep,
} from "@/lib/auth/mfa";

const env = { AUTH_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") };

test("MFA secret encryption round-trips and differs per encryption", () => {
  const secret = generateTotpSecret();
  const a = encryptMfaSecret(env, secret);
  const b = encryptMfaSecret(env, secret);
  assert.notEqual(a, b);
  assert.equal(decryptMfaSecret(env, a), secret);
  assert.equal(decryptMfaSecret(env, b), secret);
});

test("TOTP generation/verification and replay-step detection", () => {
  const secret = "JBSWY3DPEHPK3PXP";
  const now = 1_700_000_000_000;
  const code = totpCode(secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(secret, code), false); // not current time, but step check below
  const step = verifyTotpAtStep(secret, code, now, 1);
  assert.ok(step !== null);
  assert.equal(verifyTotpAtStep(secret, "000000", now, 1), null);
});

test("recovery codes are normalized, hashed, and unique-looking", () => {
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  const normalized = normalizeRecoveryCode(` ${codes[0]!.toLowerCase()} `);
  assert.match(normalized, /^[A-Z0-9]+$/);
  const h1 = hashRecoveryCode(codes[0]!);
  const h2 = hashRecoveryCode(codes[0]!.toLowerCase().replace(/-/g, ""));
  assert.equal(h1, h2);
  assert.notEqual(h1, hashRecoveryCode(codes[1]!));
});
