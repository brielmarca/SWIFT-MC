import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { assertStagingDatabase, stagingDatabaseTls } from "./staging-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const nodeRuntime = process.env.BACKEND_RUNTIME === "node";
  if (nodeRuntime) assertStagingDatabase(connectionString);
  const ssl = nodeRuntime ? { ...stagingDatabaseTls(), rejectUnauthorized: true as const } : undefined;
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 3000,
      query_timeout: 5000,
      ...(ssl ? { ssl } : {}),
    }),
  });
}

// Route modules are loaded independently of whether their handlers are called.
// Keep database configuration and client construction inside the request path.
let client: PrismaClient | undefined;
export function getPrisma(): PrismaClient {
  client ??= globalForPrisma.prisma ?? createPrismaClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}
