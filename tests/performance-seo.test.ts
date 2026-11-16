import test from "node:test";
import assert from "node:assert/strict";
import nextConfig from "@/next.config";
import { serializeJsonLd } from "@/components/seo/json-ld";

test("JSON-LD is safe against script-tag termination and preserves data", () => {
  const input = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "</script><img src=x onerror=alert(1)>",
    description: "Linha\u2028seguinte",
  };
  const result = serializeJsonLd(input);
  assert.ok(!result.includes("</script>"));
  assert.ok(!result.includes("<img"));
  assert.deepEqual(JSON.parse(result), input);
});

test("rank artwork is immutable only when filenames carry versions", async () => {
  const configured = await nextConfig.headers?.() ?? [];
  const cacheRule = (path: string) => configured
    .find((entry) => entry.source === path)
    ?.headers.find((header) => header.key.toLowerCase() === "cache-control")?.value;

  for (const rank of ["swift", "eclipse", "cosmic", "overdrive"]) {
    assert.equal(cacheRule(`/brand/ranks/${rank}-v2.webp`), "public, max-age=31536000, immutable");
  }
  assert.equal(cacheRule("/brand/:path*"), "public, max-age=86400, stale-while-revalidate=604800");
  assert.equal(cacheRule("/account/:path*"), undefined);
  assert.equal(cacheRule("/admin/:path*"), undefined);
  assert.equal(cacheRule("/api/:path*"), undefined);
});

test("security headers apply broadly and no analytics domains load without an ID", async () => {
  const configured = await nextConfig.headers?.() ?? [];
  const headers = configured.find((entry) => entry.source === "/:path*")?.headers ?? [];
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /form-action 'self'/);
  for (const name of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
    assert.ok(headers.some((item) => item.key === name), name);
  }
});
