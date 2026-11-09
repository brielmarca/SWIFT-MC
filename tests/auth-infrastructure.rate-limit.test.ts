import assert from "node:assert/strict";
import test from "node:test";
import { CloudflareRateLimiter, RejectingRateLimiter, createRateLimiter, rateLimitResponse, rateLimitHeaders } from "@/lib/auth-infrastructure/rate-limit";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

// ---------------------------------------------------------------------------
// CloudflareRateLimiter
// ---------------------------------------------------------------------------

test("CloudflareRateLimiter delegates to AUTH_RATE_LIMIT binding", async () => {
  let receivedKey: string | null = null;
  const binding = {
    limit: async (input: { key: string }) => {
      receivedKey = input.key;
      return { success: true };
    },
  };
  const limiter = new CloudflareRateLimiter(binding);
  const result = await limiter.check({ key: "test-key-123" });
  assert.equal(result, true);
  assert.equal(receivedKey, "test-key-123");
});

test("CloudflareRateLimiter returns false when binding rejects", async () => {
  const binding = {
    limit: async () => ({ success: false }),
  };
  const limiter = new CloudflareRateLimiter(binding);
  const result = await limiter.check({ key: "any-key" });
  assert.equal(result, false);
});

test("CloudflareRateLimiter throws when binding is null", () => {
  assert.throws(() => new CloudflareRateLimiter(null as unknown as AuthBindings["AUTH_RATE_LIMIT"]), /binding is required/);
});

// ---------------------------------------------------------------------------
// RejectingRateLimiter (fail-closed when binding absent)
// ---------------------------------------------------------------------------

test("RejectingRateLimiter always rejects", async () => {
  const limiter = new RejectingRateLimiter();
  assert.equal(await limiter.check({ key: "anything" }), false);
});

// ---------------------------------------------------------------------------
// createRateLimiter factory
// ---------------------------------------------------------------------------

test("createRateLimiter returns CloudflareRateLimiter when binding present", () => {
  const env = { AUTH_RATE_LIMIT: { limit: async () => ({ success: true }) } as AuthBindings["AUTH_RATE_LIMIT"] };
  const limiter = createRateLimiter(env);
  assert.ok(limiter instanceof CloudflareRateLimiter);
});

test("createRateLimiter returns RejectingRateLimiter when binding absent", () => {
  const env = {} as Pick<AuthBindings, "AUTH_RATE_LIMIT">;
  const limiter = createRateLimiter(env);
  assert.ok(limiter instanceof RejectingRateLimiter);
});

// ---------------------------------------------------------------------------
// rateLimitResponse
// ---------------------------------------------------------------------------

test("rateLimitResponse returns 429 with Retry-After header", () => {
  const response = rateLimitResponse();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "60");
  assert.ok(response.headers.get("cache-control")?.includes("private, no-store"));
});

test("rateLimitHeaders includes Retry-After", () => {
  const headers = rateLimitHeaders(120) as Record<string, string>;
  assert.equal(headers["Retry-After"], "120");
});
