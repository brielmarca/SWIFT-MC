import "server-only";
import { PrismaClient } from "@prisma/client";
import { IdentityRepository, type AuthIdentity, type AuthUser } from "@/lib/auth-domain/repositories";
import { mapAuthIdentity, mapUser } from "./mappers";

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByProviderAndSubject(provider: AuthIdentity["provider"], providerSubject: string): Promise<AuthIdentity | null> {
    const record = await this.prisma.authIdentity.findUnique({
      where: { provider_providerSubject: { provider, providerSubject } },
    });
    return record ? mapAuthIdentity(record) : null;
  }

  async findByUserAndProvider(userId: string, provider: AuthIdentity["provider"]): Promise<AuthIdentity | null> {
    const record = await this.prisma.authIdentity.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    return record ? mapAuthIdentity(record) : null;
  }

  async resolveOwner(identityId: string): Promise<{ userId: string; user: AuthUser } | null> {
    const record = await this.prisma.authIdentity.findUnique({
      where: { id: identityId },
      include: { user: true },
    });
    if (!record || !record.user) return null;
    return { userId: record.userId, user: mapUser(record.user) };
  }
}
