import "server-only";
import { createAuthPrisma, probeAuthDatabase } from "../auth-infrastructure/prisma";

/** Phase A factory only. Call inside a request; never retain the client globally. */
export function createProbePrisma(hyperdrive: { connectionString: string }) {
  return createAuthPrisma({ AUTH_HYPERDRIVE: hyperdrive });
}

/** Optional read-only connectivity probe; does not inspect or mutate application tables. */
export async function probeDatabase(hyperdrive: { connectionString: string }) {
  return probeAuthDatabase({ AUTH_HYPERDRIVE: hyperdrive });
}
