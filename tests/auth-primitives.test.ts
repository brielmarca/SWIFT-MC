import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword, passwordHashNeedsUpgrade, PASSWORD_MAX_BYTES, isPasswordPolicyValid } from "@/lib/auth/password";

test("opaque tokens contain 32 random bytes with canonical encoding and domain-separated digests", async () => {
  const hash = await hashPassword("fixture-password-123");
  assert.match(hash, /^\$swiftmc\$scrypt\$v=1\$N=32768,r=8,p=3\$[\w-]{22}\$[\w-]{43}$/);
  assert.equal(await verifyPassword("fixture-password-123", hash), true);
  for (const wrong of ["wrong-password-123", "wrong-password-123".normalize("NFD")]) assert.equal(await verifyPassword("fixture-password-123", wrong), false);
  assert.notEqual(await hashPassword("fixture-password-123"), hash);
  assert.equal(passwordHashNeedsUpgrade(hash), false);
});

test("password boundaries and untrusted encoded parameters fail closed", async () => {
  const hash = await hashPassword("fixture-password-123");
  for (const malformed of ["", "x".repeat(1000), hash + "$extra", hash.replace("v=1", "v=2"), hash.replace("32768", "1073741824"), hash.replace("p=3", "p=1"), hash.replace(/.$/, "="), hash.replace(/\$[^$]+$/, "$short")]) {
    assert.equal(await verifyPassword("fixture-password-123", malformed), false);
    assert.equal(passwordHashNeedsUpgrade(malformed), true);
  }
  for (const password of ["", "x".repeat(11), "x".repeat(PASSWORD_MAX_BYTES + 1), "🔐".repeat(257), "\ud800"]) {
    await assert.rejects(hashPassword(password), /Invalid password input/);
    assert.equal(await verifyPassword("fixture-password-123", password), false);
  }
  const boundary = "x".repeat(PASSWORD_MAX_BYTES);
  assert.equal(await verifyPassword(boundary, await hashPassword(boundary)), true);
});

test("password policy requires the minimum length before a new credential is hashed", async () => {
  assert.equal(isPasswordPolicyValid("a".repeat(11)), false);
  assert.equal(isPasswordPolicyValid("a".repeat(12)), true);
  assert.equal(isPasswordPolicyValid(""), false);
  await assert.rejects(hashPassword("a".repeat(11)), /Invalid password input/);
  const hash = await hashPassword("a".repeat(12));
  assert.equal(await verifyPassword("a".repeat(12), hash), true);
  assert.equal(await verifyPassword("a".repeat(11), hash), false);
});

test("all auth routes require authentication (no real auth creation)", async () => {
  const ordersRoute = await import("@/app/api/orders/route");
  const paymentRoute = await import("@/app/api/orders/[orderNumber]/payment/route");
  const webhookRoute = await import("@/app/api/webhooks/mercadopago/route");

  assert.ok(typeof ordersRoute.POST === "function", "orders POST handler should exist");
  assert.ok(typeof paymentRoute.POST === "function", "payment POST handler should exist");
  assert.ok(typeof webhookRoute.POST === "function", "webhook POST handler should exist");

  const ordersResponse = await ordersRoute.POST(new Request("https://swiftmc.example/api/orders", {
    method: "POST",
    headers: { cookie: "" },
  }));
  assert.ok(ordersResponse.status !== 200, `orders route should reject unauthenticated access, got ${ordersResponse.status}`);
  assert.ok([401, 429].includes(ordersResponse.status), `expected 401 or 429, got ${ordersResponse.status}`);

  const paymentResponse = await paymentRoute.POST(new Request("https://swiftmc.example/api/orders/ORD-1/payment", {
    method: "POST",
    headers: { cookie: "" },
  }));
  assert.ok(paymentResponse.status !== 200, `payment route should reject unauthenticated access, got ${paymentResponse.status}`);
  assert.ok([401, 429].includes(paymentResponse.status), `expected 401 or 429, got ${paymentResponse.status}`);

  const webhookResponse = await webhookRoute.POST(new Request("https://swiftmc.example/api/webhooks/mercadopago", {
    method: "POST",
    headers: { cookie: "" },
  }));
  assert.equal(webhookResponse.status, 503);
  const body = await webhookResponse.json();
  assert.equal(body.error, "DEMO_ONLY");
});