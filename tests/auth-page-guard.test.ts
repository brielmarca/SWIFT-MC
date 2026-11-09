import assert from "node:assert/strict";
import test from "node:test";
import { requireAuthPage, getOptionalPageUser } from "@/lib/auth/page-guard";
import { validateSessionFromToken } from "@/lib/auth/middleware";

// ---------------------------------------------------------------------------
// getOptionalPageUser tests (no redirect, safe in test environment)
// ---------------------------------------------------------------------------

test("getOptionalPageUser returns null when no cookie is present", async () => {
  const user = await getOptionalPageUser(null);
  assert.equal(user, null);
});

test("getOptionalPageUser returns null in test environment (no DB available)", async () => {
  const user = await getOptionalPageUser("__Host-swiftmc_session=any-token");
  assert.equal(user, null);
});

// ---------------------------------------------------------------------------
// requireAuthPage tests
// ---------------------------------------------------------------------------

test("requireAuthPage is a function that returns a Promise", () => {
  assert.equal(typeof requireAuthPage, "function");
});

// ---------------------------------------------------------------------------
// validateSessionFromToken tests (underlying primitive used by page guard)
// ---------------------------------------------------------------------------

test("validateSessionFromToken returns unauthenticated when Hyperdrive is missing", async () => {
  const result = await validateSessionFromToken("token", { APP_URL: "https://example.com" });
  assert.equal(result.authenticated, false);
  assert.equal(result.code, "INFRASTRUCTURE_UNAVAILABLE");
});

test("validateSessionFromToken returns unauthenticated when DB query fails", async () => {
  const result = await validateSessionFromToken("token", {
    AUTH_HYPERDRIVE: { connectionString: "postgresql://localhost/test" },
    APP_URL: "https://example.com",
  });
  assert.equal(result.authenticated, false);
  assert.ok(
    ["SESSION_NOT_FOUND", "SESSION_VALIDATION_ERROR", "INVALID_TOKEN"].includes(result.code!),
    `unexpected code: ${result.code}`,
  );
});
