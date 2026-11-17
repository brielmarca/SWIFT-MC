-- Discord OAuth, admin provisioning allowlist, and MFA credentials.
-- No plaintext MFA secrets or provider tokens are stored.

CREATE TABLE IF NOT EXISTS "ProvisionedAdmin" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "discordSubject" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedByUserId" TEXT,
  "claimedAt" TIMESTAMPTZ(3),
  CONSTRAINT "ProvisionedAdmin_discordSubject_key" UNIQUE ("discordSubject"),
  CONSTRAINT "ProvisionedAdmin_claimedByUserId_key" UNIQUE ("claimedByUserId"),
  CONSTRAINT "ProvisionedAdmin_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE IF NOT EXISTS "MfaCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "secretCiphertext" VARCHAR(2048) NOT NULL,
  "enabledAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaCredential_userId_key" UNIQUE ("userId"),
  CONSTRAINT "MfaCredential_identityId_key" UNIQUE ("identityId"),
  CONSTRAINT "MfaCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "MfaCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AuthIdentity"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- Enforce: admin allowlist key is a provider subject, never an email/display name.
-- Rejects values containing '@' or whitespace/control characters.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProvisionedAdmin_discordSubject_subject_check') THEN
    ALTER TABLE "ProvisionedAdmin" ADD CONSTRAINT "ProvisionedAdmin_discordSubject_subject_check"
      CHECK (position('@' in "discordSubject") = 0 AND "discordSubject" !~ '[[:space:][:cntrl:]]' AND char_length(btrim("discordSubject")) > 0);
  END IF;
END $$;

-- Enforce: MFA credential may only attach to a DISCORD identity and its owner.
CREATE OR REPLACE FUNCTION auth_mfa_credential_guard() RETURNS trigger AS $$
DECLARE ident_user TEXT; ident_provider "AuthProvider";
BEGIN
  SELECT "userId", "provider" INTO ident_user, ident_provider FROM "AuthIdentity" WHERE "id" = NEW."identityId";
  IF ident_user IS NULL THEN RAISE EXCEPTION 'MfaCredential identity does not exist'; END IF;
  IF ident_provider <> 'DISCORD' THEN RAISE EXCEPTION 'MfaCredential requires DISCORD identity'; END IF;
  IF ident_user <> NEW."userId" THEN RAISE EXCEPTION 'MfaCredential identity owner mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mfa_credential_guard ON "MfaCredential";
CREATE TRIGGER mfa_credential_guard BEFORE INSERT OR UPDATE ON "MfaCredential"
  FOR EACH ROW EXECUTE FUNCTION auth_mfa_credential_guard();

-- Enforce: admin promotion only by allowlist claim and only for DISCORD identity.
CREATE OR REPLACE FUNCTION auth_provisioned_admin_claim_guard() RETURNS trigger AS $$
DECLARE ident_user TEXT; ident_provider "AuthProvider";
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."claimedByUserId" IS DISTINCT FROM OLD."claimedByUserId" THEN
    IF OLD."claimedByUserId" IS NOT NULL THEN RAISE EXCEPTION 'ProvisionedAdmin claim is immutable'; END IF;
    IF NEW."claimedByUserId" IS NULL THEN RAISE EXCEPTION 'ProvisionedAdmin claim cannot be cleared'; END IF;
    SELECT "userId", "provider" INTO ident_user, ident_provider FROM "AuthIdentity"
      WHERE "provider" = 'DISCORD' AND "providerSubject" = NEW."discordSubject";
    IF ident_user IS NULL OR ident_provider <> 'DISCORD' THEN RAISE EXCEPTION 'ProvisionedAdmin claim requires matching DISCORD identity'; END IF;
    IF ident_user <> NEW."claimedByUserId" THEN RAISE EXCEPTION 'ProvisionedAdmin claim owner mismatch'; END IF;
    UPDATE "User" SET "role" = 'ADMIN', "updatedAt" = now() WHERE "id" = NEW."claimedByUserId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provisioned_admin_claim_guard ON "ProvisionedAdmin";
CREATE TRIGGER provisioned_admin_claim_guard BEFORE UPDATE ON "ProvisionedAdmin"
  FOR EACH ROW EXECUTE FUNCTION auth_provisioned_admin_claim_guard();

-- Role is server-controlled: prevent direct client-side style self-promotion by
-- blocking role changes except the internal allowlist-claim path.
CREATE OR REPLACE FUNCTION auth_user_role_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."role" IS DISTINCT FROM OLD."role" THEN
    IF NEW."role" = 'ADMIN' AND EXISTS (
      SELECT 1 FROM "ProvisionedAdmin" p
      JOIN "AuthIdentity" i ON i."provider" = 'DISCORD' AND i."providerSubject" = p."discordSubject"
      WHERE p."claimedByUserId" = NEW."id" AND i."userId" = NEW."id"
    ) THEN
      RETURN NEW;
    END IF;
    IF NEW."role" = 'OWNER' AND current_setting('app.allow_owner_role', true) = 'true' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'User role mutation is restricted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_role_guard ON "User";
CREATE TRIGGER user_role_guard BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION auth_user_role_guard();
