import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Leave HTML pages crawlable so their noindex directives can be read.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/"] },
    sitemap: siteUrl("/sitemap.xml"),
  };
}
