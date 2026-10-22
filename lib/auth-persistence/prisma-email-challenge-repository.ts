import "server-only";
import { PrismaClient } from "@prisma/client";
import { EmailChallengeRepository, type EmailChallenge } from "@/lib/auth-domain/repositories";
import { mapEmailChallenge } from "./mappers";

export class PrismaEmailChallengeRepository implements EmailChallengeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    userId: string | null;
    emailNormalized: string;
    purpose: "REGISTER" | "VERIFY_EMAIL" | "CHANGE_EMAIL" | "PASSWORD_RESET";
    tokenHash: string;
    authVersion: number | null;
    expiresAt: Date;
  }): Promise<EmailChallenge> {
    const record = await this.prisma.emailChallenge.create({ data: params });
    return mapEmailChallenge(record);
  }

  /**
   * Atomically consumes a challenge: single-use, unexpired only.
   * Equivalent to UPDATE ... WHERE tokenHash = ? AND consumedAt IS NULL AND expiresAt > now.
   * Returns null when already consumed, expired, or absent, preventing replay races.
   * Purpose binding is enforced by the caller/domain service after consumption.
   */
  async consume(tokenHash: string): Promise<EmailChallenge | null> {
    const now = new Date();
    const result = await this.prisma.emailChallenge.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (result.count === 0) return null;
    const record = await this.prisma.emailChallenge.findUnique({ where: { tokenHash } });
    return record ? mapEmailChallenge(record) : null;
  }

  async expire(tokenHash: string): Promise<void> {
    await this.prisma.emailChallenge.updateMany({
      where: { tokenHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async invalidateOutstanding(
    emailNormalized: string,
    purpose: "REGISTER" | "VERIFY_EMAIL" | "CHANGE_EMAIL" | "PASSWORD_RESET",
    exceptTokenHash?: string,
  ): Promise<void> {
    await this.prisma.emailChallenge.updateMany({
      where: {
        emailNormalized,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
        ...(exceptTokenHash !== undefined ? { tokenHash: { not: exceptTokenHash } } : {}),
      },
      data: { consumedAt: new Date() },
    });
  }
}
