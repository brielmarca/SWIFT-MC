import assert from "node:assert/strict";
import test from "node:test";
import { createLockoutDatabase } from "./helpers/login-lockout";

test("persistent lockout: threshold, blocked correct password, expiry, reset and account isolation", async () => {
  const { db, repository } = await createLockoutDatabase();
  try {
    await db.query(`INSERT INTO "PasswordCredential" ("identityId", "passwordHash") VALUES ('a', 'hash'), ('b', 'hash')`);
    for (let i = 0; i < 4; i++) assert.equal(await repository.recordLoginAttempt("a", "hash", false), false);
    assert.equal(await repository.recordLoginAttempt("a", "hash", true), true, "success before threshold resets failures");
    await Promise.all(Array.from({ length: 5 }, () => repository.recordLoginAttempt("a", "hash", false)));
    const state = async () => (await db.query<{ failedLoginAttempts: number; lockedUntil: Date }>(
      `SELECT "failedLoginAttempts", "lockedUntil" FROM "PasswordCredential" WHERE "identityId" = 'a'`,
    )).rows[0];
    const locked = await state();
    assert.equal(locked.failedLoginAttempts, 5);
    assert.ok(new Date(locked.lockedUntil).getTime() > Date.now() + 14 * 60_000);
    assert.equal(await repository.recordLoginAttempt("a", "hash", true), false);
    assert.equal(await repository.recordLoginAttempt("a", "hash", false), false);
    assert.deepEqual(await state(), locked, "blocked attempts neither clear nor extend lockout");
    assert.equal(await repository.recordLoginAttempt("b", "hash", true), true);
    await db.exec(`UPDATE "PasswordCredential" SET "lockedUntil" = now() - INTERVAL '1 second' WHERE "identityId" = 'a'`);
    assert.equal(await repository.recordLoginAttempt("a", "hash", false), false);
    assert.equal((await state()).failedLoginAttempts, 1);
    assert.equal((await state()).lockedUntil, null);
    assert.equal(await repository.recordLoginAttempt("a", "hash", true), true);
    assert.equal((await state()).failedLoginAttempts, 0);
    assert.equal(await repository.recordLoginAttempt("a", "stale-hash", true), false);
    assert.equal(await repository.recordLoginAttempt("missing", "hash", true), false);
    assert.equal(await repository.recordLoginAttempt("a' OR true --", "hash", true), false);
  } finally {
    await db.close();
  }
});
