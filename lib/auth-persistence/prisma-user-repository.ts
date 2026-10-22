import "server-only";
import { PrismaClient } from "@prisma/client";
import { UserRepository, type AuthUser } from "@/lib/auth-domain/repositories";
import { mapUser } from "./mappers";

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(userId: string): Promise<AuthUser | null> {
    const record = await this.prisma.user.findUnique({ where: { id: userId } });
    return record ? mapUser(record) : null;
  }

  async findByNormalizedEmail(emailNormalized: string): Promise<AuthUser | null> {
    const record = await this.prisma.user.findUnique({ where: { emailNormalized } });
    return record ? mapUser(record) : null;
  }

  /**
   * Atomically bumps authVersion only when the current value equals expected.
   * Equivalent to: UPDATE ... WHERE id = ? AND authVersion = ? SET authVersion = authVersion + 1
   * Returns false when a concurrent change occurred (zero rows matched).
   */
  async bumpAuthVersion(userId: string, expectedAuthVersion: number): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, authVersion: expectedAuthVersion },
      data: { authVersion: { increment: 1 } },
    });
    return result.count === 1;
  }
}
