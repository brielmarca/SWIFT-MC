-- Add optional user phone and allow secure email-change mutations needed by
-- EMAIL_PASSWORD identity (subject is canonical normalized email) while keeping
-- identity ownership/provider immutable and Discord subjects immutable.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneE164" VARCHAR(20);
ALTER TABLE "User"
  ADD CONSTRAINT "User_phone_e164_format" CHECK ("phoneE164" IS NULL OR "phoneE164" ~ '^\+[1-9][0-9]{7,14}$');

-- Existing trigger made providerSubject immutable for all providers, which blocks
-- secure verified email changes for EMAIL_PASSWORD identities. Replace with:
-- owner/provider immutable always; providerSubject immutable except
-- EMAIL_PASSWORD identities (email change updates canonical subject atomically).
CREATE OR REPLACE FUNCTION "auth_identity_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'Auth identity provider and owner are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."providerSubject" IS DISTINCT FROM OLD."providerSubject"
     AND OLD."provider" <> 'EMAIL_PASSWORD' THEN
    RAISE EXCEPTION 'Auth identity subject is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
