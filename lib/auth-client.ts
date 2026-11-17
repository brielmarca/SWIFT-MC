// The CSRF cookie is intentionally readable by JavaScript. Session cookies
// remain HttpOnly and are sent exclusively by the browser.
export function extractCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("__Host-swiftmc_csrf="))
    ?.split("=")
    .slice(1)
    .join("=") ?? null;
}
