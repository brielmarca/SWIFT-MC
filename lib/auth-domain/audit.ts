import "server-only";
import { sanitizeAuthAuditMetadata } from "@/lib/auth/audit-metadata";

/**
 * Canonical auth audit event catalog.
 *
 * Metadata for every event must pass through sanitizeAuthAuditMetadata before
 * persistence. The sanitizer strips passwords, password hashes, raw session
 * tokens, OAuth tokens, reset tokens, CSRF tokens, and complete request bodies.
 *
 * Never include in audit metadata:
 *   - passwords
 *   - password hashes
 *   - raw session tokens
 *   - OAuth tokens
 *   - reset tokens
 *   - CSRF tokens
 *   - complete request bodies
 */

export const AUTH_AUDIT_EVENTS = Object.freeze({
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_REVOKED: "SESSION_REVOKED",
  LOGOUT_ALL: "LOGOUT_ALL",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_COMPLETED: "PASSWORD_RESET_COMPLETED",
  OAUTH_STARTED: "OAUTH_STARTED",
  OAUTH_COMPLETED: "OAUTH_COMPLETED",
  OAUTH_FAILED: "OAUTH_FAILED",
  IDENTITY_LINKED: "IDENTITY_LINKED",
  IDENTITY_UNLINKED: "IDENTITY_UNLINKED",
} as const);

export type AuthAuditEventType = typeof AUTH_AUDIT_EVENTS[keyof typeof AUTH_AUDIT_EVENTS];

export const AUTH_AUDIT_OUTCOMES = Object.freeze({
  SUCCESS: "success",
  FAILURE: "failure",
  RATE_LIMITED: "rate_limited",
} as const);

export type AuthAuditOutcome = typeof AUTH_AUDIT_OUTCOMES[keyof typeof AUTH_AUDIT_OUTCOMES];

export function assertAuthAuditEventType(value: string): asserts value is AuthAuditEventType {
  const allowed = Object.values(AUTH_AUDIT_EVENTS) as readonly AuthAuditEventType[];
  if (!allowed.includes(value as AuthAuditEventType)) {
    throw new TypeError("Invalid auth audit event type");
  }
}

export function assertAuthAuditOutcome(value: string): asserts value is AuthAuditOutcome {
  const allowed = Object.values(AUTH_AUDIT_OUTCOMES) as readonly AuthAuditOutcome[];
  if (!allowed.includes(value as AuthAuditOutcome)) {
    throw new TypeError("Invalid auth audit outcome");
  }
}

export function buildAuthAuditRecord(params: {
  eventType: string;
  outcome: string;
  requestId: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string | null;
  subjectUserId?: string | null;
}) {
  assertAuthAuditEventType(params.eventType);
  assertAuthAuditOutcome(params.outcome);

  return {
    eventType: params.eventType,
    outcome: params.outcome,
    requestId: params.requestId,
    metadata: sanitizeAuthAuditMetadata(params.metadata ?? {}),
    actorUserId: params.actorUserId ?? null,
    subjectUserId: params.subjectUserId ?? null,
  };
}
