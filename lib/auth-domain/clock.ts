import "server-only";

/**
 * Injected clock so authentication business logic never calls Date.now() directly.
 * Tests supply a deterministic FixedClock; production uses SystemClock.
 */
export interface Clock {
  /** Returns a fresh snapshot of the current time. */
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
