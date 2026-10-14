import assert from "node:assert/strict";
import test, { after } from "node:test";

import { createTestPrisma, hasDatabase } from "@/tests/integration/helpers";

import { POST } from "@/app/api/orders/route";
import { validateOrderInput } from "@/lib/orders/order-input";

const db = createTestPrisma();
const createdOrderNumbers: string[] = [];

after(async () => {
  if (!db) {
    return;
  }

  if (createdOrderNumbers.length > 0) {
    await db.order.deleteMany({ where: { orderNumber: { in: createdOrderNumbers } } });
  }

  await db.$disconnect();
});

const databaseOptions = { skip: !hasDatabase ? "DATABASE_URL is not configured" : false };

test("POST /api/orders blocks demo orders", databaseOptions, async () => {
  assert.ok(db);

  const request = new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "integration-unpriced-rank-0001",
    },
    body: JSON.stringify({
      rankSlug: "swift",
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
    }),
  });
  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "DEMO_ONLY");
});

test("rejects an unknown rank", databaseOptions, async () => {
  assert.ok(db);

  const request = new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "integration-unknown-rank-0001",
    },
    body: JSON.stringify({
      rankSlug: "unknown-rank",
      minecraftUsername: "ValidPlayer",
      email: "player@example.com",
    }),
  });
  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "DEMO_ONLY");
});

test("rejects an invalid Minecraft username", databaseOptions, async () => {
  assert.ok(db);

  const request = new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "integration-invalid-username-0001",
    },
    body: JSON.stringify({
      rankSlug: "swift",
      minecraftUsername: "invalid username",
      email: "player@example.com",
    }),
  });
  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "DEMO_ONLY");
});

test("rejects an invalid email", databaseOptions, async () => {
  assert.ok(db);

  const request = new Request("http://localhost/api/orders", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "integration-invalid-email-0001",
    },
    body: JSON.stringify({
      rankSlug: "swift",
      minecraftUsername: "ValidPlayer",
      email: "not-an-email",
    }),
  });
  const response = await POST(request);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.error, "DEMO_ONLY");
});

test("unpriced ranks cannot enable the order endpoint", async () => {
  const result = validateOrderInput({
    rankSlug: "swift",
    minecraftUsername: "ValidPlayer",
    email: "player@example.com",
  });

  assert.deepEqual(result, { error: "UNPRICED_RANK" });
  assert.equal(POST().status, 503);
});

test("demo requests do not create database orders", databaseOptions, async () => {
  assert.ok(db);

  const validated = validateOrderInput({
    rankSlug: "swift",
    minecraftUsername: "ValidPlayer",
    email: "player@example.com",
  });

  assert.deepEqual(validated, { error: "UNPRICED_RANK" });
  const before = await db.order.count();
  assert.equal(POST().status, 503);
  assert.equal(await db.order.count(), before);
});
