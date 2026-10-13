import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export function createTestPrisma(): PrismaClient | undefined {
  if (!hasDatabase) {
    return undefined;
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}
