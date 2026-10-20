import "server-only";

/** Prototype only: configuration must come from the server, never Host/forwarded headers. */
export function hasExactOrigin(headers: Headers, trustedOrigin: string): boolean {
  try {
    const configured = new URL(trustedOrigin);
    if (!['https:', 'http:'].includes(configured.protocol) || configured.origin !== trustedOrigin) return false;
    const origin = headers.get("origin");
    return origin !== null && origin === trustedOrigin && new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

/** Conservative local redirect policy; encoded URL delimiters are intentionally unsupported. */
export function internalReturnPath(value: string): string | null {
  const unsafeCharacters = (text: string) => /[\\\s]/u.test(text) || [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
  if (!value.startsWith("/") || value.startsWith("//") || unsafeCharacters(value)) return null;
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
