import "server-only";

export const AUDIT_METADATA_MAX_BYTES = 4096;
type AuditValue = string | number | boolean;
const ENUM_FIELDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  provider: ["EMAIL_PASSWORD", "DISCORD"],
  role: ["USER", "SUPPORT", "MODERATOR", "ADMIN", "OWNER"],
  intent: ["LOGIN", "LINK"],
  challengePurpose: ["REGISTER", "VERIFY_EMAIL", "CHANGE_EMAIL", "PASSWORD_RESET"],
  reason: ["INVALID_CREDENTIALS", "EXPIRED", "REVOKED", "RATE_LIMITED", "ORIGIN_REJECTED", "CSRF_REJECTED"],
});

/** Strict allowlist: unknown keys and invalid values are stripped, including nested bodies.
 * No free-text strings, identifiers, URLs, headers, IPs or user-agent strings are accepted.
 * Extend only with reviewed bounded fields; arbitrary secrets cannot be recognized by regex.
 */
export function sanitizeAuthAuditMetadata(input: unknown): Record<string, AuditValue> {
  if (input === null || typeof input !== "object" || Array.isArray(input) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new TypeError("Invalid audit metadata");
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(descriptors).length > 64) throw new RangeError("Audit metadata too large");
  const output: Record<string, AuditValue> = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!Object.hasOwn(descriptor, "value")) throw new TypeError("Invalid audit metadata");
    const value: unknown = descriptor.value;
    if (Object.hasOwn(ENUM_FIELDS, key) && typeof value === "string" && ENUM_FIELDS[key].includes(value)) output[key] = value;
    else if (key === "rememberMe" && typeof value === "boolean") output[key] = value;
    else if (key === "attemptCount" && typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 10000) output[key] = value;
  }
  // Pretty JSON conservatively budgets the spaces PostgreSQL jsonb text adds.
  if (Buffer.byteLength(JSON.stringify(output, null, 2), "utf8") > AUDIT_METADATA_MAX_BYTES) throw new RangeError("Audit metadata too large");
  return output;
}
