import { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { PrismaPasswordCredentialRepository } from "@/lib/auth-persistence/prisma-password-repository";

/** Execute the production parameterized SQL against isolated PostgreSQL WASM.
 * No network connection or application database is used.
 */
export async function createLockoutDatabase() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE "PasswordCredential" (
    "identityId" TEXT PRIMARY KEY, "passwordHash" VARCHAR(512) NOT NULL
  )`);
  await db.exec(await readFile(new URL("../../prisma/migrations/20261105000000_add_login_lockout/migration.sql", import.meta.url), "utf8"));
  const prisma = {
    async $queryRaw(parts: TemplateStringsArray, ...values: unknown[]) {
      const sql = parts.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, "");
      return (await db.query(sql, values)).rows;
    },
  } as unknown as PrismaClient;
  return { db, repository: new PrismaPasswordCredentialRepository(prisma) };
}
