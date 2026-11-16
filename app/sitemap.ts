import type { MetadataRoute } from "next";
import { ranks } from "@/data/ranks";
import { getPublishedGuides } from "@/data/wiki";
import { listPublicNews } from "@/lib/editorial/posts";
import { PUBLIC_PAGES, siteUrl } from "@/lib/seo";

// Scheduled news must appear only after its actual publication time.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublicNews();
  const paths = [
    ...Object.keys(PUBLIC_PAGES),
    ...ranks.map((rank) => `/ranks/${encodeURIComponent(rank.slug)}`),
    ...getPublishedGuides().map((guide) => `/wiki/${encodeURIComponent(guide.slug)}`),
    ...posts.map((post) => `/news/${encodeURIComponent(post.slug)}`),
  ];
  // There are no authoritative modified dates for these local pages.
  return paths.map((path) => ({ url: siteUrl(path) }));
}
