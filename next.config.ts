import type { NextConfig } from "next";

const immutableRankArtwork = ["swift", "eclipse", "cosmic", "overdrive"].map((slug) => ({
  source: `/brand/ranks/${slug}-v2.webp`,
  headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
}));

const nextConfig: NextConfig = {
  output: process.env.BUILD_VPS === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  async headers() {
    // Static Next/RSC and vinext bootstrap scripts require inline scripts today.
    // This is a baseline CSP, not a nonce-based XSS defense. No unsafe-eval in production.
    const development = process.env.NODE_ENV === "development";
    const ga4Configured = /^G-[A-Z0-9]{6,16}$/.test((process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "").trim());
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}${ga4Configured ? " https://www.googletagmanager.com" : ""}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      `img-src 'self' data: blob:${ga4Configured ? " https://www.google-analytics.com" : ""}`,
      `connect-src 'self'${development ? " ws: wss:" : ""}${ga4Configured ? " https://www.google-analytics.com https://region1.google-analytics.com" : ""}`,
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; ");
    // HSTS belongs on the production HTTPS edge; local/preview HTTP must remain usable.
    return [
      { source: "/brand/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
      // Specific rules must follow general ones to win header precedence.
      ...immutableRankArtwork,
      {
        source: "/:path*",
        headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
