import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import type { AuthBindings } from "./bindings";
import { getPrisma } from "@/lib/prisma";

const HYPERDRIVE_HOST_SUFFIX = ".hyperdrive.db";

function isHyperdriveConnection(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith(HYPERDRIVE_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export function buildPgConfig(connectionString: string) {
  const config: {
    connectionString: string;
    max: number;
    connectionTimeoutMillis: number;
    query_timeout: number;
    ssl?: { rejectUnauthorized: boolean; ca?: string; servername?: string };
  } = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 3000,
    query_timeout: 5000,
  };

  // Production connections via Cloudflare Hyperdrive terminate TLS at the edge.
  // Enforce certificate and hostname verification (rejectUnauthorized: true) so
  // the client never accepts an unauthenticated or mismatched server certificate.
  // Hyperdrive->origin TLS is managed by the Cloudflare platform and is not
  // client-configurable: see docs/auth-infrastructure.md for the platform-level
  // requirement that the Hyperdrive origin must present a valid certificate.
  if (isHyperdriveConnection(connectionString)) {
    config.ssl = { rejectUnauthorized: true };
  } else if (process.env.BACKEND_RUNTIME === "node" && process.env.DATABASE_SSL_CA_PATH && process.env.DATABASE_SSL_SERVERNAME) {
    config.ssl = {
      ca: readFileSync(process.env.DATABASE_SSL_CA_PATH, "utf8"),
      servername: process.env.DATABASE_SSL_SERVERNAME,
      rejectUnauthorized: true,
    };
  }

  return config;
}

/** Invoke inside the Worker request. Never cache the client or adapter globally. */
export function createAuthPrisma(env: Pick<AuthBindings, "AUTH_HYPERDRIVE">): PrismaClient {
  const connectionString = env.AUTH_HYPERDRIVE?.connectionString;
  if (!connectionString) throw new Error("AUTH_HYPERDRIVE binding is required");
  return new PrismaClient({
    adapter: new PrismaPg(buildPgConfig(connectionString)),
  });
}

/** Callback must await all work and must not return/retain the client. */
export async function withAuthPrisma<T>(
  env: Pick<AuthBindings, "AUTH_HYPERDRIVE">,
  callback: (client: PrismaClient) => Promise<T>,
): Promise<T> {
  if (process.env.BACKEND_RUNTIME === "node") return callback(getPrisma());
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
