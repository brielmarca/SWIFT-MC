import "server-only";
import { PrismaClient } from "@prisma/client";
import { PasswordCredentialRepository, type PasswordCredential } from "@/lib/auth-domain/repositories";
import { mapPasswordCredential } from "./mappers";

export class PrismaPasswordCredentialRepository implements PasswordCredentialRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByIdentity(identityId: string): Promise<PasswordCredential | null> {
    const record = await this.prisma.passwordCredential.findUnique({ where: { identityId } });
    return record ? mapPasswordCredential(record) : null;
  }

  /**
   * Replaces the stored password hash. Only a hash is ever accepted; plaintext
   * passwords are never handled by this repository. changedAt is refreshed on
   * replacement. The SQL trigger restricts credentials to EMAIL_PASSWORD
   * identities and rejects any attempt to attach one to another provider.
   */
  async replacePasswordHash(identityId: string, passwordHash: string): Promise<void> {
    await this.prisma.passwordCredential.update({
      where: { identityId },
      data: { passwordHash, changedAt: new Date() },
    });
  }
}
