import assert from "node:assert/strict";
import test from "node:test";
import {
  limiterKeyForEmail, limiterKeyForEmailAndIp, limiterKeyForUser, limiterKeyForChallenge,
} from "@/lib/auth-domain/rate-limit";

test("rate-limit keys are deterministic with same input/key", () => {
  const key = "test-hmac-key";
  const a = limiterKeyForEmail(key, "a@example.com");
  const b = limiterKeyForEmail(key, "a@example.com");
  assert.equal(a, b);
  assert.equal(typeof a, "string");
  assert.equal(a.length, 64); // sha256 hex
});

test("rate-limit keys differ across purposes", () => {
  const key = "test-hmac-key";
  const email = limiterKeyForEmail(key, "a@example.com");
  const emailIp = limiterKeyForEmailAndIp(key, "a@example.com", "1.2.3.4");
  const user = limiterKeyForUser(key, "user_1");
  assert.notEqual(email, emailIp);
  assert.notEqual(email, user);
  assert.notEqual(emailIp, user);
});

test("email+ip differs from email-only", () => {
  const key = "test-hmac-key";
  const a = limiterKeyForEmail(key, "a@example.com");
  const b = limiterKeyForEmailAndIp(key, "a@example.com", "1.2.3.4");
  const c = limiterKeyForEmailAndIp(key, "a@example.com", "5.6.7.8");
  assert.notEqual(a, b);
  assert.notEqual(b, c);
});

test("raw email never appears in limiter key", () => {
  const key = "test-hmac-key";
  const k = limiterKeyForEmail(key, "a@example.com");
  assert.equal(k.includes("a@example.com"), false);
  assert.equal(k.includes("@"), false);
});

test("different HMAC keys produce different keys", () => {
  const a = limiterKeyForEmail("key1", "a@example.com");
  const b = limiterKeyForEmail("key2", "a@example.com");
  assert.notEqual(a, b);
});

test("challenge key is domain-separated from user key", () => {
  const key = "test-hmac-key";
  const same = "user_1";
  const a = limiterKeyForUser(key, same);
  const b = limiterKeyForChallenge(key, same);
  assert.notEqual(a, b);
});
