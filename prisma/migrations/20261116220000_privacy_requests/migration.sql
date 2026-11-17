-- Authenticated requests, human review required. No automatic export, deletion or disclosure.
CREATE TABLE "PrivacyRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "kind" VARCHAR(32) NOT NULL,
  "details" VARCHAR(800),
  "status" VARCHAR(24) NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivacyRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "PrivacyRequest_kind_check" CHECK ("kind" IN ('ACCESS','CORRECTION','DELETION','PORTABILITY','CONSENT','OTHER')),
  CONSTRAINT "PrivacyRequest_status_check" CHECK ("status" IN ('OPEN','IN_REVIEW','CLOSED','REJECTED')),
  CONSTRAINT "PrivacyRequest_details_check" CHECK ("details" IS NULL OR (char_length(btrim("details")) BETWEEN 1 AND 800))
);
CREATE INDEX "PrivacyRequest_status_createdAt_idx" ON "PrivacyRequest"("status","createdAt");
CREATE INDEX "PrivacyRequest_userId_createdAt_idx" ON "PrivacyRequest"("userId","createdAt");
CREATE UNIQUE INDEX "PrivacyRequest_one_pending_kind_idx" ON "PrivacyRequest" ("userId","kind") WHERE "status" IN ('OPEN','IN_REVIEW');
