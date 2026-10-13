import { eventPosts } from "./events";
import { newsPosts } from "./news";
import { siteAnnouncement } from "./announcement";
import type { ArticleBlock, ContentImage, ContentStatus, EventPost, NewsPost, SiteAnnouncement } from "./types";

export { newsPosts, eventPosts, siteAnnouncement };
export type { NewsPost, EventPost, SiteAnnouncement, ArticleBlock, ContentImage, ContentStatus };

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** A post is visible only when published and its publication date has passed. */
export function isNewsVisible(post: NewsPost, now: number = Date.now()): boolean {
  const publishedAt = Date.parse(post.publishedAt);
  return post.status === "published" && Number.isFinite(publishedAt) && publishedAt <= now;
}

/** Visible news, newest first. */
export function getPublishedNews(now: number = Date.now()): NewsPost[] {
  return newsPosts
    .filter((post) => isNewsVisible(post, now))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function getNewsBySlug(slug: string, now: number = Date.now()): NewsPost | undefined {
  return newsPosts.find((post) => post.slug === slug && isNewsVisible(post, now));
}

/** Newest featured post, when one is published. */
export function getFeaturedNews(now: number = Date.now()): NewsPost | undefined {
  return getPublishedNews(now).find((post) => post.featured);
}

export function getLatestNews(limit: number, now: number = Date.now()): NewsPost[] {
  return getPublishedNews(now).slice(0, Math.max(0, limit));
}

export type NewsFilter = { query?: string; category?: string; tag?: string };

export function filterNews(posts: readonly NewsPost[], { query = "", category = "Todas", tag = "Todos" }: NewsFilter = {}): NewsPost[] {
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return posts.filter((post) => {
    if (category !== "Todas" && post.category !== category) return false;
    if (tag !== "Todos" && !post.tags.includes(tag)) return false;
    const haystack = normalize(`${post.title} ${post.excerpt} ${post.category} ${post.tags.join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** Up to `limit` other published posts, preferring the same category then shared tags. */
export function getRelatedNews(post: NewsPost, limit = 3, now: number = Date.now()): NewsPost[] {
  return getPublishedNews(now)
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => post.tags.includes(tag)).length;
      const sameCategory = candidate.category === post.category ? 2 : 0;
      return { candidate, score: sameCategory + sharedTags };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.candidate.publishedAt) - Date.parse(a.candidate.publishedAt))
    .slice(0, Math.max(0, limit))
    .map(({ candidate }) => candidate);
}

export function getNewsCategories(posts: readonly NewsPost[]): string[] {
  return [...new Set(posts.map((post) => post.category))];
}

export function getNewsTags(posts: readonly NewsPost[]): string[] {
  return [...new Set(posts.flatMap((post) => post.tags))];
}

export function isEventVisible(event: EventPost): boolean {
  return event.status === "published" && Number.isFinite(Date.parse(event.startsAt));
}

/** Visible events split by date: upcoming ascending, past most recent first. */
export function classifyEvents(now: number = Date.now(), events: readonly EventPost[] = eventPosts): { upcoming: EventPost[]; past: EventPost[] } {
  const visible = events.filter((event) => isEventVisible(event));
  const upcoming = visible
    .filter((event) => Date.parse(event.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const past = visible
    .filter((event) => Date.parse(event.startsAt) <= now)
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
  return { upcoming, past };
}

/** The single active announcement inside its time window, or null. */
export function getActiveAnnouncement(now: number = Date.now(), announcement: SiteAnnouncement | null = siteAnnouncement): SiteAnnouncement | null {
  if (!announcement) return null;
  const { startsAt, expiresAt } = announcement;
  if (startsAt && Date.parse(startsAt) > now) return null;
  if (expiresAt && Date.parse(expiresAt) <= now) return null;
  return announcement;
}
