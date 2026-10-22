-- Prepared offline from the commerce-only Prisma schema. NOT applied.
-- Review and exercise on PostgreSQL staging before deployment.
BEGIN;

CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPPORT', 'MODERATOR', 'ADMIN', 'OWNER');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "AuthProvider" AS ENUM ('EMAIL_PASSWORD', 'DISCORD');
CREATE TYPE "OAuthIntent" AS ENUM ('LOGIN', 'LINK');
CREATE TYPE "EmailChallengePurpose" AS ENUM ('REGISTER', 'VERIFY_EMAIL', 'CHANGE_EMAIL', 'PASSWORD_RESET');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "emailNormalized" VARCHAR(254),
    "emailVerifiedAt" TIMESTAMPTZ(3),
    "displayName" VARCHAR(100) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerSubject" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAuthenticatedAt" TIMESTAMPTZ(3),
    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PasswordCredential" (
    "identityId" TEXT NOT NULL,
    "passwordHash" VARCHAR(512) NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("identityId")
);
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "revocationReason" VARCHAR(100),
    "authenticatedAt" TIMESTAMPTZ(3) NOT NULL,
    "mfaVerifiedAt" TIMESTAMPTZ(3),
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuthBrowserContext" (
    "id" TEXT NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "csrfTokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthBrowserContext_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OAuthTransaction" (
    "id" TEXT NOT NULL,
    "stateHash" VARCHAR(128) NOT NULL,
    "browserContextId" TEXT NOT NULL,
    "intent" "OAuthIntent" NOT NULL,
    "linkUserId" TEXT,
    "initiatingSessionId" TEXT,
    "pkceVerifierCiphertext" VARCHAR(2048) NOT NULL,
    "returnPath" VARCHAR(2048) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "EmailChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailNormalized" VARCHAR(254) NOT NULL,
    "purpose" "EmailChallengePurpose" NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "authVersion" INTEGER,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MinecraftIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "namespace" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(128) NOT NULL,
    "lastKnownUsername" VARCHAR(64),
    "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
    "verificationMethod" VARCHAR(64) NOT NULL,
    CONSTRAINT "MinecraftIdentity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuthAuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "subjectUserId" TEXT,
    "eventType" VARCHAR(100) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "requestId" VARCHAR(128) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");
CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity"("provider", "providerSubject");
CREATE UNIQUE INDEX "AuthIdentity_userId_provider_key" ON "AuthIdentity"("userId", "provider");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_idleExpiresAt_idx" ON "Session"("idleExpiresAt");
CREATE INDEX "Session_absoluteExpiresAt_idx" ON "Session"("absoluteExpiresAt");
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");
CREATE UNIQUE INDEX "AuthBrowserContext_tokenHash_key" ON "AuthBrowserContext"("tokenHash");
CREATE INDEX "AuthBrowserContext_expiresAt_idx" ON "AuthBrowserContext"("expiresAt");
CREATE UNIQUE INDEX "OAuthTransaction_stateHash_key" ON "OAuthTransaction"("stateHash");
CREATE INDEX "OAuthTransaction_browserContextId_idx" ON "OAuthTransaction"("browserContextId");
CREATE INDEX "OAuthTransaction_linkUserId_idx" ON "OAuthTransaction"("linkUserId");
CREATE INDEX "OAuthTransaction_initiatingSessionId_idx" ON "OAuthTransaction"("initiatingSessionId");
CREATE INDEX "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");
CREATE UNIQUE INDEX "EmailChallenge_tokenHash_key" ON "EmailChallenge"("tokenHash");
CREATE INDEX "EmailChallenge_userId_idx" ON "EmailChallenge"("userId");
CREATE INDEX "EmailChallenge_emailNormalized_purpose_idx" ON "EmailChallenge"("emailNormalized", "purpose");
CREATE INDEX "EmailChallenge_expiresAt_idx" ON "EmailChallenge"("expiresAt");
CREATE UNIQUE INDEX "MinecraftIdentity_userId_key" ON "MinecraftIdentity"("userId");
CREATE UNIQUE INDEX "MinecraftIdentity_namespace_subject_key" ON "MinecraftIdentity"("namespace", "subject");
CREATE INDEX "AuthAuditEvent_actorUserId_createdAt_idx" ON "AuthAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AuthAuditEvent_subjectUserId_createdAt_idx" ON "AuthAuditEvent"("subjectUserId", "createdAt");
CREATE INDEX "AuthAuditEvent_requestId_idx" ON "AuthAuditEvent"("requestId");
CREATE INDEX "AuthAuditEvent_createdAt_idx" ON "AuthAuditEvent"("createdAt");

ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "PasswordCredential" ADD CONSTRAINT "PasswordCredential_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "AuthIdentity"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "OAuthTransaction" ADD CONSTRAINT "OAuthTransaction_browserContextId_fkey" FOREIGN KEY ("browserContextId") REFERENCES "AuthBrowserContext"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
ALTER TABLE "OAuthTransaction" ADD CONSTRAINT "OAuthTransaction_linkUserId_fkey" FOREIGN KEY ("linkUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "OAuthTransaction" ADD CONSTRAINT "OAuthTransaction_initiatingSessionId_fkey" FOREIGN KEY ("initiatingSessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "MinecraftIdentity" ADD CONSTRAINT "MinecraftIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT;
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE RESTRICT;

-- Hand-authored safeguards not representable in Prisma 6's schema language.
ALTER TABLE "User"
  ADD CONSTRAINT "User_authVersion_positive" CHECK ("authVersion" >= 1),
  ADD CONSTRAINT "User_email_normalized" CHECK ("emailNormalized" IS NULL OR
    ("emailNormalized" <> '' AND "emailNormalized" = lower(btrim("emailNormalized")))),
  ADD CONSTRAINT "User_verified_email_present" CHECK ("emailVerifiedAt" IS NULL OR "emailNormalized" IS NOT NULL);
ALTER TABLE "AuthIdentity"
  ADD CONSTRAINT "AuthIdentity_subject_nonempty" CHECK (length(btrim("providerSubject")) > 0);
ALTER TABLE "PasswordCredential"
  ADD CONSTRAINT "PasswordCredential_hash_nonempty" CHECK (length(btrim("passwordHash")) > 0);
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_hash_nonempty" CHECK (length(btrim("tokenHash")) > 0),
  ADD CONSTRAINT "Session_authVersion_positive" CHECK ("authVersion" >= 1),
  ADD CONSTRAINT "Session_expiry_order" CHECK ("createdAt" < "idleExpiresAt" AND "idleExpiresAt" <= "absoluteExpiresAt"),
  ADD CONSTRAINT "Session_revocation_reason" CHECK ("revocationReason" IS NULL OR
    ("revokedAt" IS NOT NULL AND length(btrim("revocationReason")) > 0));
ALTER TABLE "AuthBrowserContext"
  ADD CONSTRAINT "AuthBrowserContext_hashes_nonempty" CHECK (length(btrim("tokenHash")) > 0 AND length(btrim("csrfTokenHash")) > 0),
  ADD CONSTRAINT "AuthBrowserContext_expiry_order" CHECK ("createdAt" < "expiresAt");
ALTER TABLE "OAuthTransaction"
  ADD CONSTRAINT "OAuthTransaction_secrets_nonempty" CHECK (length(btrim("stateHash")) > 0 AND length(btrim("pkceVerifierCiphertext")) > 0),
  ADD CONSTRAINT "OAuthTransaction_expiry_order" CHECK ("createdAt" < "expiresAt"),
  ADD CONSTRAINT "OAuthTransaction_consumption_order" CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt"),
  ADD CONSTRAINT "OAuthTransaction_intent_context" CHECK (
    ("intent" = 'LOGIN' AND "linkUserId" IS NULL AND "initiatingSessionId" IS NULL) OR
    ("intent" = 'LINK' AND "linkUserId" IS NOT NULL AND "initiatingSessionId" IS NOT NULL));
ALTER TABLE "EmailChallenge"
  ADD CONSTRAINT "EmailChallenge_hash_nonempty" CHECK (length(btrim("tokenHash")) > 0),
  ADD CONSTRAINT "EmailChallenge_email_normalized" CHECK ("emailNormalized" <> '' AND "emailNormalized" = lower(btrim("emailNormalized"))),
  ADD CONSTRAINT "EmailChallenge_authVersion_positive" CHECK ("authVersion" IS NULL OR "authVersion" >= 1),
  ADD CONSTRAINT "EmailChallenge_expiry_order" CHECK ("createdAt" < "expiresAt"),
  ADD CONSTRAINT "EmailChallenge_consumption_order" CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt");
ALTER TABLE "MinecraftIdentity"
  ADD CONSTRAINT "MinecraftIdentity_subject_nonempty" CHECK (length(btrim("namespace")) > 0 AND length(btrim("subject")) > 0 AND length(btrim("verificationMethod")) > 0);
ALTER TABLE "AuthAuditEvent"
  ADD CONSTRAINT "AuthAuditEvent_metadata_bounded_object" CHECK (jsonb_typeof("metadata") = 'object' AND octet_length("metadata"::text) <= 4096);

-- CHECK cannot inspect another row or compare OLD/NEW. These two triggers
-- protect credential type and stable identity ownership without duplicating provider.
CREATE FUNCTION "auth_identity_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."providerSubject" IS DISTINCT FROM OLD."providerSubject"
     OR NEW."userId" IS DISTINCT FROM OLD."userId" THEN
    RAISE EXCEPTION 'Auth identity provider, subject and owner are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "AuthIdentity_immutable" BEFORE UPDATE ON "AuthIdentity"
  FOR EACH ROW EXECUTE FUNCTION "auth_identity_immutable"();

CREATE FUNCTION "auth_password_identity_provider"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "AuthIdentity" WHERE "id" = NEW."identityId" AND "provider" = 'EMAIL_PASSWORD') THEN
    RAISE EXCEPTION 'Password credentials require an EMAIL_PASSWORD identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PasswordCredential_email_password_only" BEFORE INSERT OR UPDATE ON "PasswordCredential"
  FOR EACH ROW EXECUTE FUNCTION "auth_password_identity_provider"();

COMMIT;
