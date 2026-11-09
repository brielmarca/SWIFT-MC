/** Shared server/browser allowlist; credentials and arbitrary redirects are forbidden. */
export function isStripeCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.stripe.com" &&
      !url.username && !url.password && !url.port && url.pathname.startsWith("/");
  } catch { return false; }
}
