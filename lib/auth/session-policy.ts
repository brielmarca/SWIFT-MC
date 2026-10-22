import "server-only";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seconds; remember-me changes the absolute cap, never the inactivity/recent-auth checks. */
export const SESSION_POLICY = Object.freeze({
  normalAbsoluteSeconds: DAY,
  inactivitySeconds: 2 * HOUR,
  rememberMeAbsoluteSeconds: 30 * DAY,
  staffInactivitySeconds: 30 * MINUTE,
  recentAuthenticationSeconds: 10 * MINUTE,
});
