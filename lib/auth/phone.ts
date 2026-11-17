import "server-only";

const E164_RE = /^\+[1-9]\d{7,14}$/;

export function normalizePhoneE164(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(/[\s().-]/g, "");
  if (!E164_RE.test(normalized)) return undefined;
  return normalized;
}
