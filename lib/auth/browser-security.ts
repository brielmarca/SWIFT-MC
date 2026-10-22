import "server-only";

/** Trusted configuration only, never request Host/forwarded headers. HTTPS is mandatory. */
export function hasExactOrigin(headers: Headers, trustedOrigin: string): boolean {
  try {
    const configured = new URL(trustedOrigin);
    if (configured.protocol !== "https:" || configured.origin !== trustedOrigin) return false;
    const origin = headers.get("origin");
    return origin !== null && origin === trustedOrigin && new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

/** Missing metadata is allowed for older browsers only alongside exact Origin validation.
 * Same-site sibling origins are not trusted. This is not a synchronizer-token substitute.
 */
export function hasSafeFetchMetadata(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  const mode = headers.get("sec-fetch-mode");
  const dest = headers.get("sec-fetch-dest");
  return (site === null || site === "same-origin") &&
    (mode === null || ["cors", "same-origin", "navigate"].includes(mode)) &&
    (dest === null || dest === "empty" || dest === "document");
}

/** For future browser mutations, not OAuth callback GETs. CSRF token validation is still required. */
export function hasTrustedBrowserMutation(headers: Headers, trustedOrigin: string): boolean {
  return hasExactOrigin(headers, trustedOrigin) && hasSafeFetchMetadata(headers);
}

/** On null use a fixed local fallback. Never decode the returned path again. */
export function internalReturnPath(value: string): string | null {
  const unsafeCharacters = (text: string) => /[\\\s]/u.test(text) || [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || unsafeCharacters(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (unsafeCharacters(decoded) || /%(?:[0-9a-f]{2})/i.test(decoded)) return null;
    if (decoded.startsWith("//") || /%2f|%5c/i.test(value)) return null;
    const url = new URL(value, "https://return.invalid");
    if (url.origin !== "https://return.invalid" || url.pathname.startsWith("//")) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
