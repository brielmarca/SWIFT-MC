import "server-only";
import { PrismaClient } from "@prisma/client";
import { UserRepository, type AuthUser, type AuthRole, type AuthStatus } from "@/lib/auth-domain/repositories";
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

  async createUser(params: {
    emailNormalized: string | null;
    displayName: string;
    role: AuthRole;
    status: AuthStatus;
    authVersion: number;
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<AuthUser> {
    const record = await this.prisma.user.create({
      data: {
        emailNormalized: params.emailNormalized,
        displayName: params.displayName,
        role: params.role,
        status: params.status,
        authVersion: params.authVersion,
        emailVerifiedAt: params.emailVerifiedAt,
        createdAt: params.createdAt,
        updatedAt: params.updatedAt,
      },
    });
    return mapUser(record);
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

  async updateEmailVerifiedAt(userId: string, emailVerifiedAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt },
    });
  }

  async updateProfile(userId: string, data: { displayName: string; phoneE164: string | null }): Promise<AuthUser> {
    const record = await this.prisma.user.update({
      where: { id: userId },
      data: { displayName: data.displayName, phoneE164: data.phoneE164 },
    });
    return mapUser(record);
  }

  async updateEmail(userId: string, emailNormalized: string, emailVerifiedAt: Date): Promise<AuthUser> {
    const record = await this.prisma.user.update({
      where: { id: userId },
      data: { emailNormalized, emailVerifiedAt },
    });
    return mapUser(record);
  }
}
