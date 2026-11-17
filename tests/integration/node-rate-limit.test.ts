import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { checkPostgresRateLimit } from "@/lib/auth-infrastructure/node-bindings";
import { createTestPrisma, hasDatabase } from "./helpers";
const db = createTestPrisma();
const key = randomUUID();
after(async () => {
  if (!db) return;
  await db.authRateBucket.deleteMany({ where: { key } });
  await db.$disconnect();
});
test("Node rate limits persist counters, reject excess and reset expired windows", { skip: !hasDatabase }, async () => {
  assert.ok(db);
  // Avoid boundary-sensitive concurrency assertions: persist a future window is
  // not equivalent to current, so use a transaction timestamp shared by callers.
  await db.$transaction(async tx => {
    const results = await Promise.all(Array.from({ length: 15 }, () => checkPostgresRateLimit(tx as typeof db, key)));
    assert.equal(results.filter(r => r.success).length, 10);
  });
  assert.equal((await db.authRateBucket.findUniqueOrThrow({ where: { key } })).count, 11);
  await db.authRateBucket.update({ where: { key }, data: { window: BigInt(0) } });
  assert.equal((await checkPostgresRateLimit(db, key)).success, true);
  assert.equal((await db.authRateBucket.findUniqueOrThrow({ where: { key } })).count, 1);
});
