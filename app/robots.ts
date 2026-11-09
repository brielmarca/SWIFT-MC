import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

function isIndexableCanonicalHost(): boolean {
  try {
    const host = new URL(siteUrl("/")).hostname.toLowerCase();
    return host === "swiftmc.com.br" || host === "www.swiftmc.com.br";
  } catch {
    return false;
  }
}

export default function robots(): MetadataRoute.Robots {
  if (!isIndexableCanonicalHost()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    // Leave HTML pages crawlable so their noindex directives can be read.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
