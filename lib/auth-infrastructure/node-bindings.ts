import "server-only";
import { getPrisma } from "@/lib/prisma";
import { assertStagingEnvironment } from "@/lib/staging-config";
import { assertProductionEnvironment } from "@/lib/production-config";
import type { AuthBindings } from "./bindings";
import type { PrismaClient } from "@prisma/client";
import type { BridgeBindings } from "@/lib/minecraft-bridge/auth";

/** Reuses the auth capabilities on Node; counters are atomic and survive restarts. */
export function getNodeAuthBindings(): AuthBindings & BridgeBindings & { APP_URL: string; DISCORD_CLIENT_ID?: string; DISCORD_CLIENT_SECRET?: string; DISCORD_REDIRECT_URI?: string; AUTH_ENCRYPTION_KEY?: string; AUTH_ADMIN_MFA_REQUIRED?: string } {
  if (process.env.APP_ENV === "production") assertProductionEnvironment(process.env);
  else assertStagingEnvironment(process.env);
  return {
    APP_URL: process.env.APP_URL!,
    AUTH_HYPERDRIVE: { connectionString: process.env.DATABASE_URL! },
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    MINECRAFT_BRIDGE_SECRET: process.env.MINECRAFT_BRIDGE_SECRET,
    MINECRAFT_BRIDGE_SERVER_ID: process.env.MINECRAFT_BRIDGE_SERVER_ID,
    MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS: process.env.MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS,
    AUTH_RATE_LIMIT: { limit: ({ key }) => checkPostgresRateLimit(getPrisma(), key) },
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
    AUTH_ENCRYPTION_KEY: process.env.AUTH_ENCRYPTION_KEY,
    AUTH_ADMIN_MFA_REQUIRED: process.env.AUTH_ADMIN_MFA_REQUIRED,
  };
}

export async function checkPostgresRateLimit(db: PrismaClient, key: string): Promise<{ success: boolean }> {
  const rows = await db.$queryRaw<Array<{ count: number }>>`
        INSERT INTO "AuthRateBucket" ("key", "window", "count")
        VALUES (${key}, floor(extract(epoch from now()) / 60)::bigint, 1)
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "AuthRateBucket"."window" = EXCLUDED."window"
            THEN LEAST("AuthRateBucket"."count" + 1, 11) ELSE 1 END,
          "window" = EXCLUDED."window"
        RETURNING "count"`;
  // Bounded retention, safe under concurrent requests. No raw identifiers stored.
  await db.$executeRaw`DELETE FROM "AuthRateBucket" WHERE "window" < floor(extract(epoch from now()) / 60)::bigint - 60 AND "key" IN (
        SELECT "key" FROM "AuthRateBucket" WHERE "window" < floor(extract(epoch from now()) / 60)::bigint - 60 LIMIT 100)`;
  return { success: rows[0]?.count <= 10 };
}
