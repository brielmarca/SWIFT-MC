import "server-only";
import type { ContentPost } from "@prisma/client";
import type { NewsPost } from "@/data/content/types";
import { getPublishedNews, getNewsBySlug } from "@/data/content";
import { getPrisma } from "@/lib/prisma";
import { parseArticleBody } from "./validation";

type VisibleRow = Pick<ContentPost, "slug" | "title" | "excerpt" | "category" | "tags" | "featured" | "publishedAt" | "createdAt" | "imageMime" | "imageAlt"> & { body?: string };

function mapPost(row: VisibleRow): NewsPost {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
    content: row.body ? parseArticleBody(row.body) : [],
    status: "published",
    featured: row.featured,
    publishedAt: row.publishedAt?.toISOString() ?? row.createdAt.toISOString(),
    ...(row.imageMime && row.imageAlt ? { image: { src: `/api/content/images/${row.slug}`, alt: row.imageAlt } } : {}),
  };
}

/** Read-only public content, queried dynamically to reflect admin changes. */
export async function listPublicNews(limit = 150): Promise<NewsPost[]> {
  try {
    const rows = await getPrisma().contentPost.findMany({
      where: { status: "PUBLISHED", publishedAt: { lte: new Date() } },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: Math.max(1, Math.min(150, limit)),
      select: { slug: true, title: true, excerpt: true, category: true, tags: true, featured: true, publishedAt: true, createdAt: true, imageMime: true, imageAlt: true },
    });
    const joined = [...rows.map(mapPost), ...getPublishedNews()];
    const unique = new Map<string, NewsPost>();
    for (const post of joined) if (!unique.has(post.slug)) unique.set(post.slug, post);
    return [...unique.values()].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, Math.max(1, limit));
  } catch {
    // Static content remains available while a database is unavailable, but
    // never fall back to drafts or cached authenticated content.
    return getPublishedNews();
  }
}

export async function findPublicPost(slug: string): Promise<NewsPost | undefined> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 110) return undefined;
  try {
    const row = await getPrisma().contentPost.findUnique({ where: { slug }, select: { slug: true, title: true, excerpt: true, category: true, tags: true, body: true, featured: true, publishedAt: true, createdAt: true, imageMime: true, imageAlt: true, status: true } });
    if (row) return row.status === "PUBLISHED" && row.publishedAt !== null && row.publishedAt <= new Date() ? mapPost(row) : undefined;
  } catch {
    // Static fallback only; unpublished database content must fail closed.
    return getNewsBySlug(slug);
  }
  return getNewsBySlug(slug);
}

export function relatedPublicNews(post: NewsPost, all: readonly NewsPost[], limit = 3): NewsPost[] {
  return all.filter(p => p.slug !== post.slug)
    .map(p => ({ p, score: Number(p.category === post.category) * 2 + p.tags.filter(tag => post.tags.includes(tag)).length }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.p.publishedAt) - Date.parse(a.p.publishedAt))
    .slice(0, limit).map(x => x.p);
}
