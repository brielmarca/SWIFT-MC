import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { createAuthPrisma, withAuthPrisma, probeAuthDatabase } from "../lib/auth-infrastructure/prisma";
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
  for (const name of ["AUTH_DIAGNOSTICS_TOKEN", "AUTH_DIAGNOSTICS_ENABLED", "DIRECT_DATABASE_URL", "AUTH_HYPERDRIVE"]) assert.ok(!(name in worker.env));
  const staging = config({ mode: "auth-staging", isPreview: false }).worker;
  assert.equal(staging.name, "swift-mc-auth-staging");
  assert.deepEqual(staging.env.AUTH_DIAGNOSTICS_TOKEN, { type: "secret" });
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
