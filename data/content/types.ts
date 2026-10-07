// Typed local content source for news, events and site announcements.
// Content lives here — never inside UI components. No database or CMS yet.

export type ContentStatus = "draft" | "published";

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: readonly string[] };

export type ContentImage = { src: string; alt: string };

export type NewsPost = {
  /** Stable URL-safe slug. Never reuse or rename after publishing. */
  slug: string;
  title: string;
  excerpt: string;
  status: ContentStatus;
  /** ISO 8601 publication date (with offset). Shown in the listing and metadata. */
  publishedAt: string;
  category: string;
  tags: readonly string[];
  featured: boolean;
  image?: ContentImage;
  content: readonly ArticleBlock[];
};

export type EventPost = {
  /** Stable URL-safe slug. */
  slug: string;
  title: string;
  description: string;
  status: ContentStatus;
  /** ISO 8601 start date/time (with offset). Drives upcoming/past classification. */
  startsAt: string;
  /** Optional ISO 8601 end date/time (with offset). */
  endsAt?: string;
  /** Optional free-form place, e.g. "Arena do SWIFT". */
  location?: string;
  /** Optional server mode, e.g. "PvP", "Survival". */
  mode?: string;
  /** When true, renders the site's configured Discord invite as the CTA. */
  discordCta?: boolean;
};

export type SiteAnnouncement = {
  /** Stable id used for the browser dismissal key. */
  id: string;
  title: string;
  message: string;
  /** Optional internal link, e.g. "/news/manutencao". */
  href?: string;
  linkLabel?: string;
  /** Optional ISO 8601 active window. Missing bounds are treated as open. */
  startsAt?: string;
  expiresAt?: string;
};
