import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// The DB test runner (`npm run test:db`) provides the isolated target and
// SWIFTMC_TEST_DB_MODE. Direct execution skips safely to avoid false failures.
const mode = process.env.SWIFTMC_TEST_DB_MODE;
const supplied = process.env.TEST_DATABASE_URL ?? "";
const consistent = !!supplied && process.env.DATABASE_URL === supplied && process.env.DIRECT_DATABASE_URL === supplied;
let valid = false;
if (consistent) {
  try {
    const url = new URL(supplied);
    if (mode === "remote") {
      valid = /^postgres(?:ql)?:\/\/swiftmc(?::[^@/?#]*)?@127\.0\.0\.1:55432\/swiftmc_test$/.test(supplied) &&
        url.hostname === "127.0.0.1" && url.port === "55432" && url.username === "swiftmc" &&
        url.pathname === "/swiftmc_test" && !url.search && !url.hash;
    } else if (mode === "local") {
      valid = url.hostname === "localhost" && url.username === "swiftmc_test" &&
        url.pathname === "/swiftmc_test" &&
        /^\/tmp\/swiftmc-pg-test-[A-Za-z0-9]+$/.test(url.searchParams.get("host") ?? "");
    }
  } catch { valid = false; }
}
export const hasDatabase = valid;

export function createTestPrisma(): PrismaClient | undefined {
  if (!hasDatabase) return undefined;
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}
