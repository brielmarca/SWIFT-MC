import process from "node:process";
import { URL } from "node:url";
import { spawnSync } from "node:child_process";

// Load local development values, but never override explicitly injected CI values.
try { process.loadEnvFile(); } catch (error) { if (error.code !== "ENOENT") throw error; }
const direct = process.env.DIRECT_DATABASE_URL;
if (!direct) throw new Error("DIRECT_DATABASE_URL is required for migration tooling");
const url = new URL(direct);
if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname.endsWith(".hyperdrive.local")) {
  throw new Error("Migration tooling requires a direct PostgreSQL origin connection");
}
const action = process.argv[2];
if (!["status", "deploy", "dev"].includes(action) || process.argv.length !== 3) throw new Error("Expected status, deploy or dev");
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", action], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: direct, DIRECT_DATABASE_URL: direct },
});
if (result.error) throw new Error("Unable to launch Prisma CLI");
process.exitCode = result.status ?? 1;
