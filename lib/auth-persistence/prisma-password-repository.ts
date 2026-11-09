import "server-only";
import { PrismaClient } from "@prisma/client";
import { PasswordCredentialRepository, type PasswordCredential, type LoginAttemptRepository } from "@/lib/auth-domain/repositories";
import { mapPasswordCredential } from "./mappers";

export class PrismaPasswordCredentialRepository implements PasswordCredentialRepository, LoginAttemptRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordLoginAttempt(identityId: string, expectedPasswordHash: string, passwordOk: boolean): Promise<boolean> {
    // One row-locked UPDATE prevents lost increments and successful logins
    // clearing a concurrent lock. Database time is shared across all workers.
    // Hash matching rejects verification of a concurrently replaced password.
    const rows = await this.prisma.$queryRaw<Array<{ allowed: boolean }>>`
      UPDATE "PasswordCredential"
      SET "failedLoginAttempts" = CASE
        WHEN ${passwordOk} THEN 0
        WHEN "lockedUntil" IS NOT NULL THEN 1
        ELSE LEAST("failedLoginAttempts" + 1, 5)
      END,
      "lockedUntil" = CASE
        WHEN NOT ${passwordOk} AND "lockedUntil" IS NULL AND "failedLoginAttempts" >= 4
          THEN statement_timestamp() + INTERVAL '15 minutes'
        ELSE NULL
      END
      WHERE "identityId" = ${identityId}
        AND "passwordHash" = ${expectedPasswordHash}
        AND ("lockedUntil" IS NULL OR "lockedUntil" <= statement_timestamp())
      RETURNING ("failedLoginAttempts" = 0 AND "lockedUntil" IS NULL) AS allowed
    `;
    return passwordOk && rows[0]?.allowed === true;
  }

  async findByIdentity(identityId: string): Promise<PasswordCredential | null> {
    const record = await this.prisma.passwordCredential.findUnique({ where: { identityId } });
    return record ? mapPasswordCredential(record) : null;
  }

  async createPasswordHash(identityId: string, passwordHash: string): Promise<void> {
    await this.prisma.passwordCredential.create({
      data: { identityId, passwordHash, changedAt: new Date() },
    });
  }

  /**
   * Replaces the stored password hash only while it still equals the previously
   * verified hash: one conditional UPDATE (WHERE identityId + passwordHash) so a
   * request verified against stale state cannot overwrite a newer credential.
   * Returns false when zero rows matched. Only a hash is ever accepted; plaintext
   * passwords are never handled by this repository. changedAt is refreshed on
   * replacement. The SQL trigger restricts credentials to EMAIL_PASSWORD
   * identities and rejects any attempt to attach one to another provider.
   */
  async replacePasswordHashIfUnchanged(
    identityId: string,
    expectedPasswordHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.passwordCredential.updateMany({
      where: { identityId, passwordHash: expectedPasswordHash },
      data: { passwordHash, changedAt: new Date() },
    });
    return result.count === 1;
  }
}
