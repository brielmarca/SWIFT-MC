import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_PRIVACY_ACTIONS, PRIVACY_ACTION_TARGETS, adminPrivacyActionSchema, parseAdminPrivacyQuery, readPrivacyJson } from "../lib/privacy-request-api";

test("admin workflow accepts only approved transitions, with attestation for final states", () => {
  for (const action of ADMIN_PRIVACY_ACTIONS) {
    const expectedStatus = action === "START_REVIEW" ? "OPEN" : "IN_REVIEW";
    assert.equal(adminPrivacyActionSchema.safeParse({ action, expectedStatus, attested: true }).success, true);
    assert.ok(PRIVACY_ACTION_TARGETS[action]);
  }
  assert.equal(adminPrivacyActionSchema.safeParse({ action: "COMPLETE", expectedStatus: "IN_REVIEW" }).success, false);
  assert.equal(adminPrivacyActionSchema.safeParse({ action: "REJECT", expectedStatus: "IN_REVIEW", attested: false }).success, false);
  assert.equal(adminPrivacyActionSchema.safeParse({ action: "COMPLETE", expectedStatus: "OPEN", attested: true }).success, false);
  assert.equal(adminPrivacyActionSchema.safeParse({ action: "START_REVIEW", expectedStatus: "IN_REVIEW" }).success, false);
  assert.equal(adminPrivacyActionSchema.safeParse({ action: "COMPLETE", expectedStatus: "IN_REVIEW", userId: "other", attested: true }).success, false);
});
test("admin query rejects unknown keys, duplicate filters and invalid pages", () => {
  assert.deepEqual(parseAdminPrivacyQuery("https://swiftmc.com.br/api/admin/privacy-requests"), { page: 1 });
  assert.deepEqual(parseAdminPrivacyQuery("https://swiftmc.com.br/api/admin/privacy-requests?page=3&status=OPEN"), { page: 3, status: "OPEN" });
  for (const query of ["?page=0","?page=-1","?page=10001","?page=1&page=2","?status=SECRET","?userId=other","?status=OPEN&status=CLOSED"])
    assert.equal(parseAdminPrivacyQuery("https://swiftmc.com.br/api/admin/privacy-requests" + query), null);
});
test("JSON parser rejects oversized streams even without Content-Length", async () => {
  const request = new Request("https://swiftmc.com.br/api/privacy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "ACCESS" }) });
  assert.deepEqual(await readPrivacyJson(request), { kind: "ACCESS" });
  const huge = new Request("https://swiftmc.com.br/api/privacy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "ACCESS", details: "a".repeat(2049) }) });
  await assert.rejects(readPrivacyJson(huge), RangeError);
  const forbidden = new Request("https://swiftmc.com.br/api/privacy", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  await assert.rejects(readPrivacyJson(forbidden), /INVALID_CONTENT_TYPE/);
});
