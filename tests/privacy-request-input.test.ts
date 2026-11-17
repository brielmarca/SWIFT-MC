import assert from "node:assert/strict";
import { test } from "node:test";
import { privacyRequestInputSchema, PRIVACY_REQUEST_KINDS } from "../lib/privacy-request-input";
test("privacy requests allow supported types only", () => {
  for (const kind of PRIVACY_REQUEST_KINDS) assert.equal(privacyRequestInputSchema.safeParse({kind}).success, true);
});
test("privacy requests reject unknown properties and excessive details", () => {
  assert.equal(privacyRequestInputSchema.safeParse({kind:"ACCESS",userId:"other"}).success, false);
  assert.equal(privacyRequestInputSchema.safeParse({kind:"DELETION",details:"x".repeat(801)}).success, false);
  assert.equal(privacyRequestInputSchema.safeParse({kind:"DELETE_ALL"}).success, false);
  assert.equal(privacyRequestInputSchema.safeParse({kind:"ACCESS",details:"  "}).success, false);
});
