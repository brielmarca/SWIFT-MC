import assert from "node:assert/strict";
import test from "node:test";
import { hasExactOrigin, internalReturnPath } from "../lib/auth-feasibility/security";
import { createProbePrisma } from "../lib/auth-feasibility/prisma";

test("request-scoped adapter construction is independent of DATABASE_URL", async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    // Inert local constructor fixture: no credentials and no connection/query is made.
    const binding = { connectionString: "postgresql://localhost:1/swiftmc_phase_a" };
    const first = createProbePrisma(binding);
    const second = createProbePrisma(binding);
    assert.notEqual(first, second);
    await Promise.all([first.$disconnect(), second.$disconnect()]);
    assert.throws(() => createProbePrisma({ connectionString: "" }), /binding is required/);
  } finally {
    if (saved === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = saved;
  }
});

test("protected mutations require the exact configured origin", () => {
  const trusted = "https://swiftmc.example:8443";
  assert.equal(hasExactOrigin(new Headers({ Origin: trusted }), trusted), true);
  for (const origin of [null, "null", "garbage", "https://swiftmc.example", "http://swiftmc.example:8443", "https://evil.example:8443", `${trusted}/`, `${trusted}?a`, `${trusted}, https://evil.example`, "https://user@swiftmc.example:8443"]) {
    assert.equal(hasExactOrigin(new Headers(origin === null ? {} : { Origin: origin }), trusted), false, String(origin));
  }
  assert.equal(hasExactOrigin(new Headers({ Origin: "null" }), "null"), false);
});

test("return paths cannot escape the local origin, including encoded confusion", () => {
  for (const path of ["/account", "/account?tab=security", "/rules#discord"]) assert.equal(internalReturnPath(path), path);
  for (const path of ["https://evil.example", "//evil.example", "javascript:alert(1)", "data:text/html,x", "/%2fevil.example", "%2f%2fevil.example", "/%252fevil.example", "/\\evil.example", "/%5cevil.example", "/bad%", "/\n/evil.example", "/%00bad", "/..//evil.example"]) assert.equal(internalReturnPath(path), null, path);
});
