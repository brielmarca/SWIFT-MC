import type { EventPost } from "./types";

/** Builds an ISO 8601 instant at `hour`:00 Brasília time (UTC-3) on the given day offset. */
function brtIso(daysFromNow: number, hour: number): string {
  const date = new Date(Date.now() + daysFromNow * 86400000);
  date.setUTCHours(hour + 3, 0, 0, 0);
  return date.toISOString();
}

/**
 * SAMPLE CONTENT — replace these entries with real events before production.
 * `startsAt` drives automatic upcoming/past classification at request time.
 * Relative sample dates keep the preview useful; use fixed ISO dates in production.
 */
export const eventPosts: readonly EventPost[] = [
  {
    slug: "corrida-do-ender",
    title: "Corrida do Ender",
    description: "Equipes de dois disputam uma rota pelo Nether até o End com desafios a cada etapa. Premiação para os três primeiros colocados.",
    status: "published",
    startsAt: brtIso(4, 19),
    endsAt: brtIso(4, 22),
    location: "Arena do SWIFT",
    mode: "Aventura",
    discordCta: true,
  },
  {
    slug: "noite-de-construcao",
    title: "Noite de Construção colaborativa",
    description: "Encontro aberto para construir juntos o novo distrito de comércio. Traga materiais ou use os baús comunitários no spawn.",
    status: "published",
    startsAt: brtIso(11, 20),
    location: "Spawn",
    mode: "Criativo",
  },
  {
    slug: "duelo-de-chefs",
    title: "Duelo de Chefs: edição de setembro",
    description: "Competição de culinária com ingredientes sorteados. O júri avaliou sabor, apresentação e velocidade.",
    status: "published",
    startsAt: brtIso(-7, 18),
    location: "Praça do spawn",
    mode: "Evento",
  },
  {
    slug: "rascunho-feira-de-trocas",
    title: "Rascunho: feira de trocas",
    description: "Texto de trabalho — não publicado. Será finalizado antes da divulgação.",
    status: "draft",
    startsAt: brtIso(20, 15),
  },
];
