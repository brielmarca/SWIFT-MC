import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import type { AuthBindings } from "./bindings";

/** Invoke inside the Worker request. Never cache the client or adapter globally. */
export function createAuthPrisma(env: Pick<AuthBindings, "AUTH_HYPERDRIVE">): PrismaClient {
  const connectionString = env.AUTH_HYPERDRIVE?.connectionString;
  if (!connectionString) throw new Error("AUTH_HYPERDRIVE binding is required");
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1, connectionTimeoutMillis: 3000, query_timeout: 5000 }),
  });
}

/** Callback must await all work and must not return/retain the client. */
export async function withAuthPrisma<T>(
  env: Pick<AuthBindings, "AUTH_HYPERDRIVE">,
  callback: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  const client = createAuthPrisma(env);
  try {
    return await callback(client);
  } finally {
    await client.$disconnect();
  }
}

export async function probeAuthDatabase(env: Pick<AuthBindings, "AUTH_HYPERDRIVE">) {
  return withAuthPrisma(env, async (client) => {
    const rows = await client.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`;
    return rows.length === 1 && rows[0].ok === 1;
  });
}
