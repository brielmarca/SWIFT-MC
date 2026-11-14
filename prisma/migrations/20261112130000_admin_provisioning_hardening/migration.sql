-- Corrective hardening for admin provisioning/bootstrap (incremental; do not edit prior migrations).
-- Prepared for review. NOT applied in production by this change.

-- Extend allowlist with explicit target role and claim metadata for controlled, auditable provisioning.
ALTER TABLE "ProvisionedAdmin"
  ADD COLUMN IF NOT EXISTS "targetRole" "UserRole" NOT NULL DEFAULT 'ADMIN',
  ADD COLUMN IF NOT EXISTS "grantedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "consumedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "note" VARCHAR(255);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProvisionedAdmin_grantedByUserId_fkey') THEN
    ALTER TABLE "ProvisionedAdmin"
      ADD CONSTRAINT "ProvisionedAdmin_grantedByUserId_fkey"
      FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProvisionedAdmin_targetRole_check') THEN
    ALTER TABLE "ProvisionedAdmin"
      ADD CONSTRAINT "ProvisionedAdmin_targetRole_check" CHECK ("targetRole" IN ('ADMIN','OWNER'));
  END IF;
END $$;

-- Backfill consumedAt for already-claimed rows.
UPDATE "ProvisionedAdmin"
SET "consumedAt" = COALESCE("consumedAt", "claimedAt")
WHERE "claimedByUserId" IS NOT NULL AND "consumedAt" IS NULL;

-- Controlled claim guard: validates one-time immutable claim bound to DISCORD identity.
-- Runs BEFORE UPDATE so invalid claims never persist.
CREATE OR REPLACE FUNCTION auth_provisioned_admin_claim_guard() RETURNS trigger AS $$
DECLARE
  ident_user TEXT;
  ident_provider "AuthProvider";
  owner_exists BOOLEAN;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW."claimedByUserId" IS DISTINCT FROM OLD."claimedByUserId"
     OR NEW."claimedAt" IS DISTINCT FROM OLD."claimedAt"
     OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt" THEN

    IF OLD."claimedByUserId" IS NOT NULL OR OLD."claimedAt" IS NOT NULL OR OLD."consumedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'ProvisionedAdmin claim is immutable';
    END IF;
    IF NEW."claimedByUserId" IS NULL OR NEW."claimedAt" IS NULL OR NEW."consumedAt" IS NULL THEN
      RAISE EXCEPTION 'ProvisionedAdmin claim requires user and timestamps';
    END IF;

    IF NEW."targetRole" NOT IN ('ADMIN','OWNER') THEN
      RAISE EXCEPTION 'ProvisionedAdmin target role invalid';
    END IF;

    SELECT "userId", "provider" INTO ident_user, ident_provider FROM "AuthIdentity"
      WHERE "provider" = 'DISCORD' AND "providerSubject" = NEW."discordSubject";
    IF ident_user IS NULL OR ident_provider <> 'DISCORD' THEN
      RAISE EXCEPTION 'ProvisionedAdmin claim requires matching DISCORD identity';
    END IF;
    IF ident_user <> NEW."claimedByUserId" THEN
      RAISE EXCEPTION 'ProvisionedAdmin claim owner mismatch';
    END IF;

    IF NEW."targetRole" = 'OWNER' THEN
      -- Serialize OWNER grants so concurrent legitimate claims cannot both succeed.
      PERFORM pg_advisory_xact_lock(hashtext('swiftmc:provision:owner'));
      SELECT EXISTS (
        SELECT 1 FROM "User" WHERE "role" = 'OWNER' AND "id" <> NEW."claimedByUserId" FOR UPDATE
      ) INTO owner_exists;
      IF owner_exists THEN
        RAISE EXCEPTION 'Owner already exists';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Privilege grant runs AFTER the validated claim update is visible in-transaction.
-- This allows auth_user_role_guard() to verify the claimed ProvisionedAdmin row.
CREATE OR REPLACE FUNCTION auth_provisioned_admin_grant_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW."claimedByUserId" IS DISTINCT FROM OLD."claimedByUserId"
     OR NEW."claimedAt" IS DISTINCT FROM OLD."claimedAt"
     OR NEW."consumedAt" IS DISTINCT FROM OLD."consumedAt" THEN
    -- Re-check OWNER uniqueness under the same serialized lock before granting.
    IF NEW."targetRole" = 'OWNER' THEN
      PERFORM pg_advisory_xact_lock(hashtext('swiftmc:provision:owner'));
      IF EXISTS (SELECT 1 FROM "User" WHERE "role" = 'OWNER' AND "id" <> NEW."claimedByUserId") THEN
        RAISE EXCEPTION 'Owner already exists';
      END IF;
    END IF;

    UPDATE "User"
      SET "role" = NEW."targetRole", "updatedAt" = now(), "authVersion" = "authVersion" + 1
      WHERE "id" = NEW."claimedByUserId";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS provisioned_admin_claim_guard ON "ProvisionedAdmin";
CREATE TRIGGER provisioned_admin_claim_guard BEFORE UPDATE ON "ProvisionedAdmin"
  FOR EACH ROW EXECUTE FUNCTION auth_provisioned_admin_claim_guard();

DROP TRIGGER IF EXISTS provisioned_admin_grant_guard ON "ProvisionedAdmin";
CREATE TRIGGER provisioned_admin_grant_guard AFTER UPDATE ON "ProvisionedAdmin"
  FOR EACH ROW EXECUTE FUNCTION auth_provisioned_admin_grant_guard();

-- Role guard: only allow claim-driven ADMIN/OWNER grants for the exact claimed identity.
CREATE OR REPLACE FUNCTION auth_user_role_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."role" IS DISTINCT FROM OLD."role" THEN
    IF NEW."role" IN ('ADMIN','OWNER') AND EXISTS (
      SELECT 1 FROM "ProvisionedAdmin" p
      JOIN "AuthIdentity" i ON i."provider" = 'DISCORD' AND i."providerSubject" = p."discordSubject"
      WHERE p."claimedByUserId" = NEW."id"
        AND i."userId" = NEW."id"
        AND p."targetRole" = NEW."role"
        AND p."claimedAt" IS NOT NULL
        AND p."consumedAt" IS NOT NULL
    ) THEN
      RETURN NEW;
    END IF;

    IF NEW."role" = 'OWNER' AND current_setting('app.allow_owner_role', true) = 'true' THEN
      -- Restricted operational escape hatch only; must not be exposed by application endpoints.
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
