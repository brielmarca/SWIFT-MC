import "server-only";
import { PrismaClient } from "@prisma/client";
import { SessionRepository, type AuthSession } from "@/lib/auth-domain/repositories";
import { mapSession } from "./mappers";

export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    userId: string;
    tokenHash: string;
    authVersion: number;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
  }): Promise<AuthSession> {
    const record = await this.prisma.session.create({
      data: {
        userId: params.userId,
        tokenHash: params.tokenHash,
        authVersion: params.authVersion,
        idleExpiresAt: params.idleExpiresAt,
        absoluteExpiresAt: params.absoluteExpiresAt,
        authenticatedAt: new Date(),
      },
    });
    return mapSession(record);
  }

  async findByTokenDigest(tokenHash: string): Promise<AuthSession | null> {
    const record = await this.prisma.session.findUnique({ where: { tokenHash } });
    return record ? mapSession(record) : null;
  }

  /**
   * Refreshes lastSeenAt only. Never touches absoluteExpiresAt, authVersion,
   * authenticatedAt or tokenHash. No-op when the session is revoked or already
   * idle/absolute expired, so expired sessions are never revived.
   */
  async touchLastSeen(sessionId: string, lastSeenAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        idleExpiresAt: { gt: lastSeenAt },
        absoluteExpiresAt: { gt: lastSeenAt },
      },
      data: { lastSeenAt },
    });
  }

  async revoke(sessionId: string, reason?: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: reason ?? null },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revocationReason: null },
    });
  }

  async listActiveForUser(userId: string): Promise<AuthSession[]> {
    const now = new Date();
    const records = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    return records.map(mapSession);
  }
}
