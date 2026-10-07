import type { NewsPost } from "./types";

/**
 * SAMPLE CONTENT — replace these entries with real posts before production.
 * Rules: stable URL-safe `slug`, `status: "draft"` hides a post, ISO 8601
 * `publishedAt`, optional local `image` (paths under /public only).
 */
export const newsPosts: readonly NewsPost[] = [
  {
    slug: "temporada-4-sobrevivencia",
    title: "Temporada 4 do Survival começa com mapa novo",
    excerpt: "Mapa limpo, economia recalibrada e uma linha do tempo de recompensas para quem entrar desde o primeiro dia.",
    status: "published",
    publishedAt: "2026-09-28T18:00:00-03:00",
    category: "Atualizações",
    tags: ["temporada", "sobrevivencia"],
    featured: true,
    image: { src: "/brand/emblem.png", alt: "Emblema do SWIFT MC" },
    content: [
      { type: "paragraph", text: "A quarta temporada do SWIFT Survival começa no próximo sábado com um mapa completamente novo. Todo o progresso da temporada anterior foi arquivado com segurança e os saldos da economia começarão zerados para todos." },
      { type: "heading", text: "O que muda nesta temporada" },
      { type: "list", items: ["Economia recalibrada com preços revisados pela equipe.", "Terrenos protegidos desde o primeiro dia, sem janela de vulnerabilidade.", "Missões semanais com recompensas exclusivas da Temporada 4."] },
      { type: "paragraph", text: "Jogadores VIP mantêm os benefícios do rank ativo e recebem um kit de boas-vindas atualizado. Fique atento ao Discord para a contagem regressiva oficial da abertura." },
    ],
  },
  {
    slug: "atualizacao-economia-v2",
    title: "Atualização da economia: leilões e impostos",
    excerpt: "Revisão do mercado entre jogadores, novos leilões no spawn e um teto de juros para manter a balanceada.",
    status: "published",
    publishedAt: "2026-09-14T20:30:00-03:00",
    category: "Atualizações",
    tags: ["economia", "mercado"],
    featured: false,
    image: { src: "/brand/enderman.png", alt: "Ilustração de um enderman" },
    content: [
      { type: "paragraph", text: "A economia do servidor recebeu a maior revisão desde o lançamento. O objetivo é manter a progressão saudável sem tornar o acúmulo de moedas irrelevante." },
      { type: "heading", text: "Leilões no spawn" },
      { type: "paragraph", text: "A praça de leilões agora fica ao lado do spawn e funciona com ofertas moderadas por bot protegido. Itens proibidos pelas regras continuam bloqueados automaticamente." },
      { type: "heading", text: "Equilíbrio" },
      { type: "list", items: ["Novo imposto progressivo sobre grandes transações.", "Teto diário de juros em contas com saldo alto.", "Preços das lojas do servidor revisados para itens de baixo nível."] },
    ],
  },
  {
    slug: "guia-protecao-de-terrenos",
    title: "Gui novato: proteja seu terreno em 5 minutos",
    excerpt: "Passo a passo para delimitar, compartir e revisar permissões do seu terreno sem depender de suporte.",
    status: "published",
    publishedAt: "2026-08-30T15:00:00-03:00",
    category: "Guias",
    tags: ["terrenos", "guia"],
    featured: false,
    content: [
      { type: "paragraph", text: "A proteção de terrenos é a primeira defesa contra griefing. Este guia resume o fluxo oficial recomendado para novos jogadores." },
      { type: "list", items: ["Defina os limites com a ferramenta de delimitação antes de construir.", "Adicione amigos apenas com permissões específicas que você entende.", "Revise a lista de membros do terreno toda semana.", "Em caso de dúvida sobre uma permissão, pergunte no Discord antes de conceder."] },
      { type: "paragraph", text: "Denúncias de violação de terrenos devem incluir coordenadas, horário e evidências. O suporte no Discord é o canal oficial." },
    ],
  },
  {
    slug: "torneio-pvp-agosto",
    title: "Resultado do torneio PvP de agosto",
    excerpt: "16 participantes, três rodadas intensas e um campeão inédito na arena oficial do SWIFT MC.",
    status: "published",
    publishedAt: "2026-08-16T22:00:00-03:00",
    category: "Comunidade",
    tags: ["pvp", "torneio"],
    featured: false,
    content: [
      { type: "paragraph", text: "O torneio PvP de agosto terminou com 16 participantes nas finais transmitidas pelo Discord. A final foi decidida no último round, com dois pontos de diferença." },
      { type: "paragraph", text: "Os prêmios já foram entregues em jogo e as inscrições do próximo torneio abrem na próxima temporada." },
    ],
  },
  {
    slug: "manutencao-programada",
    title: "Manutenção programada dos servidores",
    excerpt: "Janela de manutenção com atualização de plugins e backup completo do mundo. Servidor fica indisponível durante o período.",
    status: "published",
    publishedAt: "2026-10-02T12:00:00-03:00",
    category: "Comunidade",
    tags: ["manutencao", "aviso"],
    featured: false,
    content: [
      { type: "paragraph", text: "O servidor passará por uma janela de manutenção para atualização de plugins e backup completo do mundo. Durante o período o acesso estará indisponível." },
      { type: "list", items: ["Início previsto: sábado, às 3h (horário de Brasília).", "Duração estimada: até 2 horas.", "Avisos em tempo real serão publicados no Discord."] },
      { type: "paragraph", text: "Nenhum progresso será perdido. Faça backup de construções críticas antes da janela, quando possível." },
    ],
  },
  {
    slug: "rascunho-evento-aniversario",
    title: "Rascunho: comemoração de aniversário do servidor",
    excerpt: "Texto de trabalho — não publicado. Será finalizado antes da data do evento.",
    status: "draft",
    publishedAt: "2026-10-20T18:00:00-03:00",
    category: "Comunidade",
    tags: ["evento"],
    featured: false,
    content: [{ type: "paragraph", text: "Conteúdo em rascunho. Não deve aparecer no site até ser publicado." }],
  },
];
