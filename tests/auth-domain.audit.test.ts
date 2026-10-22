import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_AUDIT_EVENTS, AUTH_AUDIT_OUTCOMES, buildAuthAuditRecord,
} from "@/lib/auth-domain/audit";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";
import { generateSessionToken } from "@/lib/auth/tokens";

test("audit event catalog contains canonical events", () => {
  assert.equal(AUTH_AUDIT_EVENTS.LOGIN_SUCCESS, "LOGIN_SUCCESS");
  assert.equal(AUTH_AUDIT_EVENTS.LOGIN_FAILURE, "LOGIN_FAILURE");
  assert.equal(AUTH_AUDIT_EVENTS.SESSION_CREATED, "SESSION_CREATED");
  assert.equal(AUTH_AUDIT_EVENTS.SESSION_REVOKED, "SESSION_REVOKED");
  assert.equal(AUTH_AUDIT_EVENTS.LOGOUT_ALL, "LOGOUT_ALL");
  assert.equal(AUTH_AUDIT_EVENTS.PASSWORD_CHANGED, "PASSWORD_CHANGED");
  assert.equal(AUTH_AUDIT_EVENTS.PASSWORD_RESET_REQUESTED, "PASSWORD_RESET_REQUESTED");
  assert.equal(AUTH_AUDIT_EVENTS.PASSWORD_RESET_COMPLETED, "PASSWORD_RESET_COMPLETED");
  assert.equal(AUTH_AUDIT_EVENTS.OAUTH_STARTED, "OAUTH_STARTED");
  assert.equal(AUTH_AUDIT_EVENTS.OAUTH_COMPLETED, "OAUTH_COMPLETED");
  assert.equal(AUTH_AUDIT_EVENTS.OAUTH_FAILED, "OAUTH_FAILED");
  assert.equal(AUTH_AUDIT_EVENTS.IDENTITY_LINKED, "IDENTITY_LINKED");
  assert.equal(AUTH_AUDIT_EVENTS.IDENTITY_UNLINKED, "IDENTITY_UNLINKED");
  assert.equal(Object.keys(AUTH_AUDIT_EVENTS).length, 13);
});

test("audit outcomes are success/failure/rate_limited", () => {
  assert.equal(AUTH_AUDIT_OUTCOMES.SUCCESS, "success");
  assert.equal(AUTH_AUDIT_OUTCOMES.FAILURE, "failure");
  assert.equal(AUTH_AUDIT_OUTCOMES.RATE_LIMITED, "rate_limited");
});

test("buildAuthAuditRecord sanitizes secrets from metadata", () => {
  const secret = generateSessionToken();
  const record = buildAuthAuditRecord({
    eventType: "LOGIN_SUCCESS",
    outcome: "success",
    requestId: "req_1",
    metadata: { provider: "EMAIL_PASSWORD", password: "raw", passwordHash: "$x", sessionToken: secret, rememberMe: true },
    actorUserId: "user_1",
    subjectUserId: "user_1",
  });
  assert.equal(record.eventType, "LOGIN_SUCCESS");
  assert.equal(record.outcome, "success");
  assert.equal(record.requestId, "req_1");
  assert.equal(record.metadata.password, undefined);
  assert.equal(record.metadata.passwordHash, undefined);
  assert.equal(record.metadata.sessionToken, undefined);
  assert.equal(record.metadata.provider, "EMAIL_PASSWORD");
  assert.equal(record.metadata.rememberMe, true);
  assert.equal(record.actorUserId, "user_1");
  assert.equal(record.subjectUserId, "user_1");
});

test("buildAuthAuditRecord rejects invalid event type and outcome", () => {
  assert.throws(() => buildAuthAuditRecord({ eventType: "NOT_A_REAL_EVENT", outcome: "success", requestId: "r" }), TypeError);
  assert.throws(() => buildAuthAuditRecord({ eventType: "LOGIN_SUCCESS", outcome: "bogus", requestId: "r" }), TypeError);
});

test("sanitizeAuthAuditMetadata strips nested secrets", () => {
  const clean = sanitizeAuthAuditMetadata({ reason: "INVALID_CREDENTIALS", body: { password: "x" }, csrf: generateSessionToken() });
  assert.equal(clean.password, undefined);
  assert.equal(clean.csrf, undefined);
  assert.equal(clean.reason, "INVALID_CREDENTIALS");
});
