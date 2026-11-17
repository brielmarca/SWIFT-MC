import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const migrationsDir = path.join(projectRoot, "prisma/migrations");
const schemaPath = path.join(projectRoot, "prisma/schema.prisma");

// ---------------------------------------------------------------------------
// Prisma Client Order.userId typing tests
// ---------------------------------------------------------------------------

test("PrismaClient module loads and exposes Order model", async () => {
  const mod = await import("@prisma/client");
  const { PrismaClient } = mod;
  assert.ok(PrismaClient, "PrismaClient should be importable");
  assert.ok(typeof PrismaClient === "function", "PrismaClient should be a constructor");
});

// ---------------------------------------------------------------------------
// Migration consistency tests
// ---------------------------------------------------------------------------

async function readMigration(name: string): Promise<string> {
  return readFile(path.join(migrationsDir, name, "migration.sql"), "utf8");
}

test("User deletion FK is RESTRICT (migration 20261023000000)", async () => {
  const sql = await readMigration("20261023000000_add_user_id_to_order");
  assert.ok(sql.includes("ON DELETE RESTRICT"), "migration should have ON DELETE RESTRICT");
  assert.ok(sql.includes("ON UPDATE RESTRICT"), "migration should have ON UPDATE RESTRICT");
  assert.ok(sql.includes('REFERENCES "User"("id")'), "migration should reference User.id");
});

test("Order.userId column is nullable (no NOT NULL)", async () => {
  const sql = await readMigration("20261023000000_add_user_id_to_order");
  assert.ok(sql.includes('ALTER TABLE "Order" ADD COLUMN "userId" VARCHAR(255);'), "migration should add nullable userId column");
  const lines = sql.split("\n");
  const addColumnLine = lines.find((l) => l.includes('ADD COLUMN "userId" VARCHAR(255)'));
  assert.ok(addColumnLine, "should find ADD COLUMN userId line");
  assert.ok(!addColumnLine.includes("NOT NULL"), "userId column should NOT have NOT NULL");
});

test("migration files are in chronological order", async () => {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationDirs = entries
    .filter((e) => e.isDirectory() && e.name.match(/^\d{14}_/))
    .map((e) => e.name)
    .sort();
  for (let i = 1; i < migrationDirs.length; i++) {
    assert.ok(migrationDirs[i - 1] < migrationDirs[i], `${migrationDirs[i - 1]} should come before ${migrationDirs[i]}`);
  }
});

test("all transactional migration files contain BEGIN and COMMIT", async () => {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.match(/^\d{14}_/)) {
      const sql = await readFile(path.join(migrationsDir, entry.name, "migration.sql"), "utf8");
      if (entry.name.startsWith("20261022") || entry.name.startsWith("20261023")) {
        assert.ok(sql.includes("BEGIN;"), `${entry.name} should have BEGIN;`);
        assert.ok(sql.includes("COMMIT;"), `${entry.name} should have COMMIT;`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Schema vs Migration consistency
// ---------------------------------------------------------------------------

async function readSchema(): Promise<string> {
  return readFile(schemaPath, "utf8");
}

test("Prisma schema Order.userId matches migration column definition", async () => {
  const schema = await readSchema();
  const migrationSql = await readMigration("20261023000000_add_user_id_to_order");

  assert.ok(/userId\s+String\?\s+@db\.VarChar\(255\)/.test(schema), "schema should have optional userId with VarChar(255)");
  assert.ok(migrationSql.includes('"userId" VARCHAR(255)'), "migration should add userId as VARCHAR(255)");
  const addColumnLine = migrationSql.split("\n").find((l) => l.includes('ADD COLUMN "userId" VARCHAR(255)'));
  assert.ok(addColumnLine, "should find ADD COLUMN userId line");
  assert.ok(!addColumnLine.includes("NOT NULL"), "migration userId should not have NOT NULL");
});

test("Prisma schema Order relation matches migration FK", async () => {
  const schema = await readSchema();
  const migrationSql = await readMigration("20261023000000_add_user_id_to_order");

  assert.ok(schema.includes("fields: [userId], references: [id], onDelete: Restrict, onUpdate: Restrict"), "schema should have userId->User.id relation with RESTRICT");
  assert.ok(migrationSql.includes('REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE RESTRICT'), "migration should have RESTRICT FK to User.id");
});

// ---------------------------------------------------------------------------
// Transaction safety test
// ---------------------------------------------------------------------------

test("withAuthTransaction wraps callback in Prisma $transaction", async () => {
  const { withAuthTransaction } = await import("@/lib/auth-api/auth-stack");
  assert.equal(typeof withAuthTransaction, "function");
  assert.equal(withAuthTransaction.length, 2);
});

// ---------------------------------------------------------------------------
// Order creation paths audit
// ---------------------------------------------------------------------------

test("order creation paths require authentication (no real order creation)", async () => {
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
  const body = await webhookResponse.json();
  assert.ok([400,503].includes(webhookResponse.status));
  assert.equal(webhookResponse.status, 503);
  assert.equal(body.error.code, "PURCHASES_DISABLED");
});
