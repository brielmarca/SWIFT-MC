-- Additive migration; existing credentials start unlocked. Apply before the
-- lockout-aware application. Rollback: revert application first, then remove
-- these columns in a new forward migration (discards lockout history).
ALTER TABLE "PasswordCredential"
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lockedUntil" TIMESTAMPTZ(3),
  ADD CONSTRAINT "PasswordCredential_failedLoginAttempts_check"
    CHECK ("failedLoginAttempts" BETWEEN 0 AND 5);
