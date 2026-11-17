import "server-only";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seconds. Admin/staff sessions are privileged and must never be prolonged by remember-me. */
export const SESSION_POLICY = Object.freeze({
  normalAbsoluteSeconds: DAY,
  inactivitySeconds: 2 * HOUR,
  rememberMeAbsoluteSeconds: 30 * DAY,
  staffInactivitySeconds: 30 * MINUTE,
  adminInactivitySeconds: 30 * MINUTE,
  adminAbsoluteSeconds: 8 * HOUR,
  recentAuthenticationSeconds: 10 * MINUTE,
  mfaVerificationSeconds: 10 * MINUTE,
});
