import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { URL } from "node:url";
import pg from "pg";

const REQUIRED_PG_BINARIES = ["initdb", "pg_ctl", "createdb"];

// Verify PostgreSQL server binaries are available before attempting to own a
// cluster lifecycle. Without them the script cannot initialize, start, or
// create a database, so it must fail fast with an actionable prerequisite
// rather than silently skipping integration validation.
function checkPrerequisites() {
  const bin = globalThis.process.env.PG_BIN;
  const pgLib = globalThis.process.env.PG_LIB;
  const probeEnv = pgLib ? { ...globalThis.process.env, LD_LIBRARY_PATH: [pgLib, globalThis.process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") } : globalThis.process.env;
  const missing = [];
  for (const name of REQUIRED_PG_BINARIES) {
    const executable = bin ? join(bin, name) : name;
    const result = spawnSync(executable, ["--version"], { stdio: "pipe", env: probeEnv });
    if (result.error || result.status !== 0) missing.push(name);
  }
  if (missing.length > 0) {
    const where = bin ? `PG_BIN=${bin}` : "PATH";
    const list = missing.join(", ");
    throw new Error(
      `PostgreSQL server binaries are required for test:db but were not found: ${list}\n` +
      `  Checked via ${where}.\n` +
      `  Install PostgreSQL server packages (e.g. postgresql-common, postgresql-17) and\n` +
      `  ensure initdb, pg_ctl, and createdb are executable, or set PG_BIN to the\n` +
      `  directory containing them.\n` +
      `  Integration tests cannot be validated without a disposable PostgreSQL cluster.`
    );
  }
}

// Remote usage: establish an SSH tunnel with local forwarding
// -L 127.0.0.1:55432:127.0.0.1:5432 (use -N and ExitOnForwardFailure=yes).
// Supply TEST_DATABASE_URL through a private environment/secret manager, then:
// npm run test:db -- --remote
// Never place the URL in command arguments, shell history, or source files.
// The target must be swiftmc_test, user swiftmc, at 127.0.0.1:55432.
// Query parameters are forbidden (including host overrides and SSL options).
// SSH provides transport encryption. No .env file is loaded by this runner.
const args = globalThis.process.argv.slice(2);
const remote = args.length === 1 && args[0] === "--remote";
if (args.length && !remote) throw new Error("Usage: npm run test:db -- [--remote]");

function remoteUrl() {
  const supplied = globalThis.process.env.TEST_DATABASE_URL;
  try {
    if (!supplied) throw new Error();
    const parsed = new URL(supplied);
    // Inspect raw authority as well: URL normalization must not admit alternate
    // loopback spellings. Reject all query parameters to prevent driver overrides.
    if (parsed.pathname === "/swiftmc") throw new Error();
    if (!/^postgres(?:ql)?:\/\/swiftmc(?::[^@/?#]*)?@127\.0\.0\.1:55432\/swiftmc_test$/.test(supplied) ||
        parsed.hostname !== "127.0.0.1" || parsed.port !== "55432" ||
        parsed.username !== "swiftmc" || parsed.pathname !== "/swiftmc_test" ||
        parsed.search || parsed.hash) throw new Error();
    return parsed.href;
  } catch {
    throw new Error("Remote mode requires an explicit TEST_DATABASE_URL matching the dedicated SSH-tunnel test target; production is forbidden.");
  }
}

const suppliedUrl = remote ? remoteUrl() : undefined;
if (!remote) checkPrerequisites();

// Local mode owns its cluster lifecycle and ignores supplied database URLs.
const directory = mkdtempSync(join(tmpdir(), remote ? "swiftmc-prisma-test-" : "swiftmc-pg-test-"));
const bin = globalThis.process.env.PG_BIN;
const executable = (name) => bin ? join(bin, name) : name;
const url = suppliedUrl ?? `postgresql://swiftmc_test@localhost:5432/swiftmc_test?host=${encodeURIComponent(directory)}`;
const env = {
  PATH: globalThis.process.env.PATH, HOME: globalThis.process.env.HOME,
  LD_LIBRARY_PATH: globalThis.process.env.PG_LIB,
  DATABASE_URL: url, DIRECT_DATABASE_URL: url, TEST_DATABASE_URL: url,
  NODE_OPTIONS: "--conditions=react-server", NODE_ENV: "test",
  SWIFTMC_TEST_DB_MODE: remote ? "remote" : "local",
};
function run(command, args) {
  // Remote tools/test errors can echo credentials. Never forward their raw
  // output, even on failure. Only allow numeric TAP summaries through.
  const result = spawnSync(command, args, { env, stdio: remote ? "pipe" : "inherit", encoding: "utf8" });
  if (remote) {
    for (const line of (result.stdout ?? "").split("\n")) {
      if (/^# (tests|suites|pass|fail|cancelled|skipped|todo) \d+$/.test(line)) globalThis.console.log(line);
    }
  }
  if (result.error || result.status !== 0) throw new Error(`${command} failed (${result.status ?? "unavailable"})`);
}

const quote = (name) => `"${name.replaceAll('"', '""')}"`;

async function inspectRemote() {
  // Current models use their Prisma names as table names (no @@map mappings).
  const expectedTables = new Set([...readFileSync(resolve("prisma/schema.prisma"), "utf8")
    .matchAll(/^model (\w+) \{/gm)].map((match) => match[1]));
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  try {
    // An authenticated PostgreSQL handshake verifies tunnel reachability before
    // migrations. Inspect the actual database identity, not just the URL.
    await client.connect();
    await client.query("BEGIN READ ONLY");
    // Fail rather than mistaking rows hidden by row-level security for emptiness.
    await client.query("SET LOCAL row_security = off");
    const identity = await client.query("SELECT current_database() AS db, current_user AS role");
    if (identity.rows[0].db !== "swiftmc_test" || identity.rows[0].role !== "swiftmc") throw new Error();
    const { rows } = await client.query(`SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname <> 'information_schema' AND n.nspname !~ '^pg_'
        AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')`);
    for (const table of rows) {
      if (table.schema !== "public" || table.kind !== "r" ||
          (table.name !== "_prisma_migrations" && !expectedTables.has(table.name))) throw new Error();
      if (table.name === "_prisma_migrations") continue;
      const result = await client.query(`SELECT EXISTS (SELECT 1 FROM public.${quote(table.name)}) AS populated`);
      if (result.rows[0].populated) throw new Error();
    }
    await client.query("COMMIT");
  } catch {
    throw new Error("Remote preflight refused: check tunnel reachability, database identity, permissions, unexpected relations, and existing application data. Nothing was erased.");
  } finally {
    await client.end().catch(() => {});
  }
}
let started = false;
try {
  if (remote) {
    await inspectRemote();
    globalThis.console.log("Remote preflight passed: dedicated target reachable and application tables empty");
  } else {
    run(executable("initdb"), ["-D", join(directory, "data"), "-U", "swiftmc_test", "--auth=trust", "--no-locale", "--encoding=UTF8"]);
    run(executable("pg_ctl"), ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"), "-o", `-k ${directory} -c listen_addresses=''`, "-w", "start"]);
    started = true;
    run(executable("createdb"), ["-h", directory, "-U", "swiftmc_test", "swiftmc_test"]);
  }
  const config = join(directory, "prisma.config.ts");
  writeFileSync(config, `export default { schema: ${JSON.stringify(resolve("prisma/schema.prisma"))} };\n`);
  run(resolve("node_modules/.bin/prisma"), ["migrate", "deploy", "--config", config]);
  globalThis.console.log("Prisma migration deployment completed");
  const files = ["tests/integration", "tests/payments", "tests/fulfillment"].flatMap(directory =>
    readdirSync(directory).filter(file => file.endsWith(".test.ts")).map(file => `${directory}/${file}`));
  // A second pass against the same database detects leaked fixtures and fixed-key collisions.
  for (let pass = 1; pass <= 2; pass++) {
    globalThis.console.log(`Integration pass ${pass}/2`);
    // The legacy pending-fulfillment processor intentionally scans the whole queue.
    // Keep suite files serial so it cannot consume another suite's fixtures.
    run(resolve("node_modules/.bin/tsx"), ["--experimental-test-module-mocks", "--test", "--test-concurrency=1", ...files]);
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 10000 });
    try {
      await client.connect();
      if (remote) await client.query("SET row_security = off");
      const { rows } = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`);
      for (const { tablename } of rows) {
        const result = await client.query(`SELECT count(*)::int AS count FROM public.${quote(tablename)}`);
        if (result.rows[0].count !== 0) throw new Error(`Leaked test data in ${tablename}`);
      }
      globalThis.console.log("Cleanup verified: all application tables empty");
    } finally { await client.end().catch(() => {}); }
  }
} catch (error) {
  // Never expose a driver error, connection string, or test subprocess output.
  if (remote) throw new Error("Remote database validation failed. No destructive cleanup was attempted; inspect the dedicated test database privately before retrying.");
  throw error;
} finally {
  // Remote mode owns only this local Prisma config directory, never a cluster.
  if (!remote && started) run(executable("pg_ctl"), ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"]);
  rmSync(directory, { recursive: true, force: true });
}
