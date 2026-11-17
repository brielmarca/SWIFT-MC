import "server-only";
import type { PrismaClient } from "@prisma/client";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { normalizeAuthEmail } from "@/lib/auth/email";
import { buildAuthServices, type AuthServices } from "./auth-stack";

/** Serialize issuance/resend/completion even before a User row exists. */
export function withVerificationTransaction<T>(env: Pick<AuthBindings, "AUTH_HYPERDRIVE">, email: string, callback: (services: AuthServices) => Promise<T>) {
  const normalized = normalizeAuthEmail(email);
  return withAuthPrisma(env, (prisma) => prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`swiftmc:verification:${normalized}`}, 0))`;
    // Existing-account status/version cannot change between validation and verification.
    await tx.$queryRaw`SELECT id FROM "User" WHERE "emailNormalized" = ${normalized} FOR UPDATE`;
    return callback(buildAuthServices(tx as unknown as PrismaClient));
  }));
}
