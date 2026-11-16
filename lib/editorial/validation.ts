import { z } from "zod";
import type { ArticleBlock } from "@/data/content/types";

export const postSchema = z.object({
  title: z.string().trim().min(5).max(180),
  excerpt: z.string().trim().min(15).max(350),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(110),
  category: z.enum(["Notícias", "Patch Notes", "Avisos"]),
  tags: z.string().trim().max(350),
  body: z.string().trim().min(20).max(20000),
  featured: z.boolean(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
}).strict();

export const updatePostSchema = postSchema.extend({
  revision: z.number().int().min(1),
}).strict();

export type PostInput = z.infer<typeof postSchema>;

export function normalizePostTags(input: string): string {
  const tags = input.split(",").map(tag => tag.trim().toLocaleLowerCase("pt-BR")).filter(Boolean);
  if (tags.length > 10 || tags.some(tag => tag.length > 30 || !/^[\p{L}\p{N}-]+$/u.test(tag))) {
    throw new Error("TAGS_INVALID");
  }
  return [...new Set(tags)].join(",");
}

export function parseArticleBody(input: string): ArticleBlock[] {
  // Intentionally not HTML or arbitrary Markdown: all content remains plain
  // React-escaped text, so editors cannot inject scripts or embedded iframes.
  const result: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (paragraph.length) result.push({ type: "paragraph", text: paragraph.join(" ") });
    if (bullets.length) result.push({ type: "list", items: bullets });
    paragraph = [];
    bullets = [];
  };
  for (const line of input.replace(/\r\n?/g, "\n").split("\n")) {
    const text = line.trim();
    if (!text) { flush(); continue; }
    if (text.startsWith("## ") && text.length > 3) {
      flush();
      result.push({ type: "heading", text: text.slice(3).trim() });
      continue;
    }
    if (text.startsWith("- ") && text.length > 2) {
      if (paragraph.length) flush();
      bullets.push(text.slice(2).trim());
      continue;
    }
    if (bullets.length) flush();
    paragraph.push(text);
  }
  flush();
  return result;
}
