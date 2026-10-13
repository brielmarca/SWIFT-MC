import type { MetadataRoute } from "next";
import { BRAND_IMAGE, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "pt-BR",
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#090a0f",
    theme_color: "#7c3aed",
    icons: [{ src: BRAND_IMAGE.src, sizes: `${BRAND_IMAGE.width}x${BRAND_IMAGE.height}`, type: "image/png", purpose: "any" }],
  };
}
