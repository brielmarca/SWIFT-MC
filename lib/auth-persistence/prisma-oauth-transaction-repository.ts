import "server-only";
import { PrismaClient } from "@prisma/client";
import { OAuthTransactionRepository, type OAuthTransaction } from "@/lib/auth-domain/repositories";
import { mapOAuthTransaction } from "./mappers";

export class PrismaOAuthTransactionRepository implements OAuthTransactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    stateHash: string;
    browserContextId: string;
    intent: "LOGIN" | "LINK";
    linkUserId: string | null;
    initiatingSessionId: string | null;
    pkceVerifierCiphertext: string;
    returnPath: string;
    expiresAt: Date;
  }): Promise<OAuthTransaction> {
    const record = await this.prisma.oAuthTransaction.create({ data: params });
    return mapOAuthTransaction(record);
  }

  /**
   * Atomically consumes a transaction: single-use, unexpired only.
   * Equivalent to UPDATE ... WHERE stateHash = ? AND consumedAt IS NULL AND expiresAt > now.
   * Returns null when already consumed, expired, or absent; never replayable.
   */
  async consume(stateHash: string): Promise<OAuthTransaction | null> {
    const now = new Date();
    const result = await this.prisma.oAuthTransaction.updateMany({
      where: { stateHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (result.count === 0) return null;
    const record = await this.prisma.oAuthTransaction.findUnique({ where: { stateHash } });
    return record ? mapOAuthTransaction(record) : null;
  }

  async expire(stateHash: string): Promise<void> {
    await this.prisma.oAuthTransaction.updateMany({
      where: { stateHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
