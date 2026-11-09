import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { buildPgConfig, createAuthPrisma, withAuthPrisma, probeAuthDatabase } from "../lib/auth-infrastructure/prisma";
import { runAuthDiagnostic } from "../lib/auth-infrastructure/diagnostics";
import config from "../cloudflare.config";
import { spawnSync } from "node:child_process";

const env = { AUTH_HYPERDRIVE: { connectionString: "postgresql://localhost:1/inert_test" } };
const diagnosticEnv = { ...env, AUTH_DIAGNOSTICS_ENVIRONMENT: "staging", AUTH_DIAGNOSTICS_ENABLED: "1", AUTH_DIAGNOSTICS_TOKEN: "test-only-".repeat(5) };
function request(path = "database", token = diagnosticEnv.AUTH_DIAGNOSTICS_TOKEN) {
  return new Request(`https://staging.example/auth-infrastructure-probe/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
}

test("auth scope disconnects on success and failure, without retaining clients", async (t) => {
  let disconnected = 0;
  t.mock.method(PrismaClient.prototype, "$disconnect", async () => { disconnected++; });
  const clients = new Set<PrismaClient>();
  assert.equal(await withAuthPrisma(env, async (client) => { clients.add(client); return 1; }), 1);
  await assert.rejects(withAuthPrisma(env, async (client) => { clients.add(client); throw new Error("callback failed"); }), /callback failed/);
  assert.equal(clients.size, 2);
  assert.equal(disconnected, 2);
  assert.throws(() => createAuthPrisma({}), /binding is required/);
});

test("database probe issues only SELECT 1 and disposes its client", async (t) => {
  let disconnected = false;
  t.mock.method(PrismaClient.prototype, "$disconnect", async () => { disconnected = true; });
  t.mock.method(PrismaClient.prototype, "$queryRaw", async (sql: TemplateStringsArray) => {
    assert.deepEqual([...sql], ["SELECT 1 AS ok"]);
    return [{ ok: 1 }];
  });
  assert.equal(await probeAuthDatabase(env), true);
  assert.equal(disconnected, true);
});

test("diagnostics fail closed and never disclose database errors", async (t) => {
  for (const bindings of [{}, { ...diagnosticEnv, AUTH_DIAGNOSTICS_ENABLED: "0" }, { ...diagnosticEnv, AUTH_DIAGNOSTICS_ENVIRONMENT: "production" }]) {
    assert.equal((await runAuthDiagnostic(request(), bindings)).status, 404);
  }
  assert.equal((await runAuthDiagnostic(request("scrypt", "wrong"), diagnosticEnv)).status, 404);
  assert.equal((await runAuthDiagnostic(request("scrypt?N=2"), diagnosticEnv)).status, 400);
  t.mock.method(PrismaClient.prototype, "$queryRaw", async () => { throw new Error("secret connection details"); });
  t.mock.method(PrismaClient.prototype, "$disconnect", async () => {});
  const response = await runAuthDiagnostic(request(), diagnosticEnv);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { status: "probe-failed" });
});

test("normal Worker has no diagnostic bindings or direct database URLs", () => {
  const worker = config({ mode: "production", isPreview: false }).worker;
  for (const name of ["AUTH_DIAGNOSTICS_TOKEN", "AUTH_DIAGNOSTICS_ENABLED", "DIRECT_DATABASE_URL"]) assert.ok(!(name in worker.env));
  assert.ok(!("DATABASE_URL" in worker.env));
  const staging = config({ mode: "auth-staging", isPreview: false }).worker;
  assert.equal(staging.name, "swift-mc-auth-staging");
  assert.deepEqual(staging.env.AUTH_DIAGNOSTICS_TOKEN, { type: "secret" });
});

test("production Worker receives AUTH_HYPERDRIVE binding when ID is configured", () => {
  const saved = process.env.AUTH_HYPERDRIVE_ID;
  process.env.AUTH_HYPERDRIVE_ID = "hyperdrive_prod_123";
  try {
    const worker = config({ mode: "production", isPreview: false }).worker;
    assert.deepEqual(worker.env.AUTH_HYPERDRIVE, { type: "hyperdrive", id: "hyperdrive_prod_123" });
    assert.ok(!("DATABASE_URL" in worker.env));
    assert.ok(!("DIRECT_DATABASE_URL" in worker.env));
  } finally {
    if (saved === undefined) delete process.env.AUTH_HYPERDRIVE_ID;
    else process.env.AUTH_HYPERDRIVE_ID = saved;
  }
});

test("staging scrypt returns only bounded timings and verification, never credentials", async () => {
  const response = await runAuthDiagnostic(request("scrypt"), diagnosticEnv);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(Object.keys(result).sort(), ["concurrencyTwoMs", "singleHashMs", "verificationMs", "verified"]);
  assert.equal(result.verified, true);
  for (const name of ["singleHashMs", "verificationMs", "concurrencyTwoMs"]) assert.ok(result[name] > 0);
});

test("migration tooling rejects absent direct URL and Hyperdrive proxy before invoking Prisma", () => {
  for (const direct of ["", "postgresql://user:private-test-value@proxy.hyperdrive.local/db"]) {
    const result = spawnSync(process.execPath, ["scripts/prisma-direct.mjs", "status"], {
      encoding: "utf8", env: { ...process.env, DIRECT_DATABASE_URL: direct },
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /private-test-value/);
    assert.match(result.stderr, /DIRECT_DATABASE_URL is required|direct PostgreSQL origin/);
  }
});

// ---------------------------------------------------------------------------
// PostgreSQL TLS configuration
// ---------------------------------------------------------------------------

test("buildPgConfig enforces certificate and hostname verification for Hyperdrive connections", () => {
  const config = buildPgConfig("postgresql://user:pass@abc123.hyperdrive.db:5432/mydb");
  assert.equal(config.connectionString, "postgresql://user:pass@abc123.hyperdrive.db:5432/mydb");
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("buildPgConfig enforces TLS for any Hyperdrive host suffix", () => {
  for (const host of ["x.hyperdrive.db", "prod-region.hyperdrive.db", "a.b.c.hyperdrive.db"]) {
    const config = buildPgConfig(`postgresql://user:pass@${host}:5432/mydb`);
    assert.deepEqual(config.ssl, { rejectUnauthorized: true }, `Expected TLS for ${host}`);
  }
});

test("buildPgConfig does not require TLS for non-Hyperdrive local development connections", () => {
  const config = buildPgConfig("postgresql://swiftmc:swiftmc_dev@localhost:5433/swiftmc?schema=public");
  assert.equal(config.connectionString, "postgresql://swiftmc:swiftmc_dev@localhost:5433/swiftmc?schema=public");
  assert.equal(config.ssl, undefined);
});

test("buildPgConfig never uses rejectUnauthorized: false", () => {
  const config = buildPgConfig("postgresql://user:pass@abc123.hyperdrive.db:5432/mydb");
  assert.ok(config.ssl, "ssl must be configured for Hyperdrive");
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.notEqual(config.ssl.rejectUnauthorized, false);
});
