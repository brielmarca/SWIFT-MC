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

test("POST /api/orders rejects order for unpriced rank", databaseOptions, async () => {
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

  assert.equal(response.status, 400);
  assert.equal(body.error, "Rank not available for purchase.");
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

  assert.equal(response.status, 404);
  assert.equal(body.error, "Rank not found.");
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

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid order details.");
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

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid order details.");
});

test("validateOrderInput rejects unpriced rank before database call", () => {
  const result = validateOrderInput({
    rankSlug: "swift",
    minecraftUsername: "ValidPlayer",
    email: "player@example.com",
  });

  assert.deepEqual(result, { error: "UNPRICED_RANK" });
});

test("createOrder is not called for unpriced ranks", databaseOptions, async () => {
  assert.ok(db);

  const validated = validateOrderInput({
    rankSlug: "swift",
    minecraftUsername: "ValidPlayer",
    email: "player@example.com",
  });

  assert.deepEqual(validated, { error: "UNPRICED_RANK" });
  assert.ok(!validated.data);
});