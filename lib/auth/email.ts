import "server-only";

/** Canonical website identity policy: lowercase ASCII mailbox, preserving dots and +tags.
 * Quoted local parts, IP literals and SMTPUTF8/Unicode domains are intentionally unsupported.
 * All future email lookup/write paths must use this helper.
 */
export function normalizeAuthEmail(value: string): string {
  if (typeof value !== "string" || value.length > 1024) throw new TypeError("Invalid auth email");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[\x21-\x7e]+$/.test(email)) throw new TypeError("Invalid auth email");
  const parts = email.split("@");
  if (parts.length !== 2) throw new TypeError("Invalid auth email");
  const [local, domain] = parts;
  const labels = domain.split(".");
  if (local.length > 64 || !/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(local) ||
      labels.length < 2 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      !/^[a-z]{2,63}$/.test(labels.at(-1)!)) throw new TypeError("Invalid auth email");
  return email;
}
