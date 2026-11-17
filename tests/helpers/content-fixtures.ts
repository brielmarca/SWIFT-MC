import { mock } from "node:test";
import type { EventPost, NewsPost } from "@/data/content/types";

// Synthetic editorial data belongs in tests, never in the public catalog.
export const newsFixtures: NewsPost[] = [
  { slug: "temporada-4-sobrevivencia", title: "Temporada 4", excerpt: "Novidades da comunidade", category: "Comunidade", tags: ["aviso"], featured: true },
  { slug: "atualizacao-economia-v2", title: "Atualização economia", excerpt: "Economia e leilões", category: "Atualizações", tags: ["economia"] },
  { slug: "guia", title: "Guia", excerpt: "Primeiros passos", category: "Guias", tags: ["aviso"] },
  { slug: "manutencao", title: "Manutenção", excerpt: "Aviso da comunidade", category: "Comunidade", tags: ["manutencao"] },
  { slug: "rascunho", title: "Rascunho", excerpt: "Não publicado", category: "Comunidade", tags: ["aviso"], status: "draft" },
].map((post, index) => ({
  status: "published", publishedAt: `2026-09-${28 - index}T12:00:00Z`,
  content: [{ type: "paragraph", text: "Conteúdo de teste." }],
  ...post,
} as NewsPost));

export const eventFixtures: EventPost[] = [
  { slug: "corrida", title: "Corrida do Ender", description: "Corrida de teste", startsAt: "2026-10-10T12:00:00Z", status: "published" },
  { slug: "construcao", title: "Construção", description: "Teste", startsAt: "2026-10-12T12:00:00Z", status: "published" },
  { slug: "chefs", title: "Duelo de chefs", description: "Teste", startsAt: "2026-10-01T12:00:00Z", status: "published" },
  { slug: "feira", title: "Feira de trocas", description: "Rascunho", startsAt: "2026-10-15T12:00:00Z", status: "draft" },
];

export function mockEditorialContent() {
  mock.module("@/data/content/news", { namedExports: { newsPosts: newsFixtures } });
  mock.module("@/data/content/events", { namedExports: { eventPosts: eventFixtures } });
}
