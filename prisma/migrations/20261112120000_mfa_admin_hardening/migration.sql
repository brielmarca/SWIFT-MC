-- Complete MFA hardening: pending setup, challenges, replay protection, hashed single-use recovery codes.
-- Prepared for staging review. NOT applied in production by this change.

-- Extend MfaCredential: pending secret, activation/replay state.
ALTER TABLE "MfaCredential"
  ADD COLUMN IF NOT EXISTS "pendingSecretCiphertext" VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS "pendingCreatedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "lastUsedStep" BIGINT,
  ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows are enabled credentials.
UPDATE "MfaCredential" SET "confirmedAt" = COALESCE("confirmedAt", "enabledAt") WHERE "confirmedAt" IS NULL;

-- Pending setup state for users before MFA is confirmed/enabled.
CREATE TABLE IF NOT EXISTS "MfaSetup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "secretCiphertext" VARCHAR(2048) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaSetup_userId_key" UNIQUE ("userId"),
  CONSTRAINT "MfaSetup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX IF NOT EXISTS "MfaSetup_expiresAt_idx" ON "MfaSetup"("expiresAt");

-- Single-use MFA challenge tokens for login/elevation/recovery flows.
CREATE TABLE IF NOT EXISTS "MfaChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "purpose" VARCHAR(32) NOT NULL,
  "tokenHash" VARCHAR(128) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 10,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  "verifiedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaChallenge_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "MfaChallenge_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE RESTRICT
);
CREATE INDEX IF NOT EXISTS "MfaChallenge_userId_purpose_expiresAt_idx" ON "MfaChallenge"("userId", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "MfaChallenge_sessionId_idx" ON "MfaChallenge"("sessionId");
CREATE INDEX IF NOT EXISTS "MfaChallenge_expiresAt_idx" ON "MfaChallenge"("expiresAt");

-- Hashed single-use recovery codes.
CREATE TABLE IF NOT EXISTS "MfaRecoveryCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "codeHash" VARCHAR(128) NOT NULL,
  "usedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX IF NOT EXISTS "MfaRecoveryCode_userId_usedAt_idx" ON "MfaRecoveryCode"("userId", "usedAt");
CREATE INDEX IF NOT EXISTS "MfaRecoveryCode_codeHash_idx" ON "MfaRecoveryCode"("codeHash");

ALTER TABLE "MfaChallenge"
  ADD CONSTRAINT "MfaChallenge_purpose_check" CHECK ("purpose" IN ('LOGIN','ELEVATION','DISABLE','RECOVERY')),
  ADD CONSTRAINT "MfaChallenge_attempts_check" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts"),
  ADD CONSTRAINT "MfaChallenge_expiry_order" CHECK ("createdAt" < "expiresAt"),
  ADD CONSTRAINT "MfaChallenge_hash_nonempty" CHECK (length(btrim("tokenHash")) > 0);
ALTER TABLE "MfaRecoveryCode"
  ADD CONSTRAINT "MfaRecoveryCode_hash_nonempty" CHECK (length(btrim("codeHash")) > 0);
ALTER TABLE "MfaSetup"
  ADD CONSTRAINT "MfaSetup_secret_nonempty" CHECK (length(btrim("secretCiphertext")) > 0),
  ADD CONSTRAINT "MfaSetup_expiry_order" CHECK ("createdAt" < "expiresAt");
ALTER TABLE "MfaCredential"
  ADD CONSTRAINT "MfaCredential_secret_nonempty" CHECK (length(btrim("secretCiphertext")) > 0);

-- Relax previous Discord-only MFA binding to support secure MFA for any authenticated identity owner
-- (including password/admin-capable accounts) while preserving ownership integrity.
CREATE OR REPLACE FUNCTION auth_mfa_credential_guard() RETURNS trigger AS $$
DECLARE ident_user TEXT;
BEGIN
  SELECT "userId" INTO ident_user FROM "AuthIdentity" WHERE "id" = NEW."identityId";
  IF ident_user IS NULL THEN RAISE EXCEPTION 'MfaCredential identity does not exist'; END IF;
  IF ident_user <> NEW."userId" THEN RAISE EXCEPTION 'MfaCredential identity owner mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
