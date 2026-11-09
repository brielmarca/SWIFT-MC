import "server-only";

export type RollbackRequiredCode = "CHANGE_FAILED" | "RESET_FAILED";

/**
 * Signals that a credential-replacement flow has already performed at least one
 * security-sensitive write inside the caller's transaction (challenge
 * consumption, password replacement, authVersion increment) and can therefore
 * no longer be reported as an ordinary `{ ok: false }` result.
 *
 * The error MUST propagate out of the transaction callback: returning a failure
 * object after a partial write would commit that write and leave inconsistent
 * security state (new password with a stale authVersion, consumed reset
 * challenge without a password change, sessions revoked without an increment).
 * Routes map it to the same generic public failure response as an ordinary
 * domain failure, so callers never observe success for a rolled-back operation.
 */
export class RollbackRequiredError extends Error {
  readonly code: RollbackRequiredCode;
  /** Internal reason for diagnostics; never returned to HTTP clients. */
  readonly reason: string;

  constructor(code: RollbackRequiredCode, reason: string) {
    super(reason);
    this.name = "RollbackRequiredError";
    this.code = code;
    this.reason = reason;
  }
}

export function isRollbackRequiredError(error: unknown): error is RollbackRequiredError {
  return error instanceof RollbackRequiredError;
}
