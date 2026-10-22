import "server-only";
import { PrismaClient } from "@prisma/client";
import { BrowserContextRepository, type AuthBrowserContext } from "@/lib/auth-domain/repositories";
import { mapBrowserContext } from "./mappers";

export class PrismaBrowserContextRepository implements BrowserContextRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    tokenHash: string;
    csrfTokenHash: string;
    expiresAt: Date;
  }): Promise<AuthBrowserContext> {
    const record = await this.prisma.authBrowserContext.create({ data: params });
    return mapBrowserContext(record);
  }

  async findByTokenHash(tokenHash: string): Promise<AuthBrowserContext | null> {
    const record = await this.prisma.authBrowserContext.findUnique({ where: { tokenHash } });
    return record ? mapBrowserContext(record) : null;
  }

  /**
   * Atomically consumes a browser context: single-use, unexpired only.
   * Equivalent to UPDATE ... WHERE tokenHash = ? AND consumedAt IS NULL AND expiresAt > now.
   * Returns null when already consumed, expired, or absent.
   */
  async consume(tokenHash: string): Promise<AuthBrowserContext | null> {
    const now = new Date();
    const result = await this.prisma.authBrowserContext.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (result.count === 0) return null;
    const record = await this.prisma.authBrowserContext.findUnique({ where: { tokenHash } });
    return record ? mapBrowserContext(record) : null;
  }

  async expire(tokenHash: string): Promise<void> {
    await this.prisma.authBrowserContext.updateMany({
      where: { tokenHash, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }
}
