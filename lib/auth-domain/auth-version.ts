import "server-only";

/**
 * Auth-version security semantics.
 *
 * `authVersion` is a monotonic per-user counter. Every session is stamped with the
 * user's authVersion at issuance. Validation rejects any session whose authVersion
 * no longer equals the user's current authVersion.
 *
 * Events that must bump authVersion (and thereby invalidate all existing
 * authorization) in the future persistence implementation:
 *
 *   1. password changed
 *   2. password reset
 *   3. logout all devices (revoke all sessions)
 *   4. account suspension
 *   5. sensitive role/permission changes
 *
 * The repository contract `UserRepository.bumpAuthVersion(userId, expected)` applies
 * the bump atomically only when the current value equals `expected`, preventing
 * lost updates under concurrency. No database mutations are performed here.
 */

export type AuthVersionEvent =
  | "password-changed"
  | "password-reset"
  | "logout-all-devices"
  | "account-suspended"
  | "role-permission-changed";

export const AUTH_VERSION_EVENTS: Record<AuthVersionEvent, string> = Object.freeze({
  "password-changed": "Password or credential was changed.",
  "password-reset": "Password was reset via recovery challenge.",
  "logout-all-devices": "All sessions were revoked for the account.",
  "account-suspended": "Account status was changed to suspended.",
  "role-permission-changed": "Sensitive role or permission assignment changed.",
});

export type AuthVersionEventReason = typeof AUTH_VERSION_EVENTS[AuthVersionEvent];

export function authVersionEventReason(event: AuthVersionEvent): AuthVersionEventReason {
  return AUTH_VERSION_EVENTS[event];
}

export function describeAuthVersionInvalidation(): string[] {
  return Object.keys(AUTH_VERSION_EVENTS) as AuthVersionEvent[];
}
