// Typed local wiki content source. Content lives here — never inside UI
// components. No database or CMS yet.

export const WIKI_CATEGORIES = [
  "Primeiros passos",
  "Survival",
  "Economia",
  "Comandos",
  "Ranks e VIPs",
  "Eventos",
  "Segurança",
] as const;

export type WikiCategory = (typeof WIKI_CATEGORIES)[number];

export type WikiCalloutKind = "info" | "warning";

export type WikiBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: readonly string[] }
  | { type: "steps"; items: readonly string[] }
  /** A Minecraft command rendered in a dedicated code block with one-click copy. Never executed. */
  | { type: "command"; command: string; note?: string }
  | { type: "callout"; kind: WikiCalloutKind; title?: string; text: string }
  | { type: "table"; caption?: string; headers: readonly [string, string, ...string[]]; rows: readonly (readonly string[])[] }
  /** Links to internal pages (hrefs must start with "/"). */
  | { type: "links"; items: readonly { href: string; label: string; description?: string }[] };

export type WikiSection = {
  /** URL-safe anchor id. Unique within the guide. */
  id: string;
  title: string;
  blocks: readonly WikiBlock[];
};

export type WikiGuide = {
  /** Stable URL-safe slug. Never rename after publishing. */
  slug: string;
  title: string;
  category: WikiCategory;
  description: string;
  /** Optional search/filter tags. */
  tags?: readonly string[];
  /** Optional related guide slugs; unresolved slugs are ignored. */
  related?: readonly string[];
  /** Shown in the featured row of /wiki. */
  featured?: boolean;
  /** Defaults to "published" when omitted. Drafts are hidden everywhere. */
  status?: "draft" | "published";
  /** Ordered content sections; each id becomes the `#anchor`. */
  sections: readonly WikiSection[];
};
