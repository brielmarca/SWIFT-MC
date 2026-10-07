export type RankSlug = "vip" | "vip-plus" | "mvp";

export type RankComparison = {
  protectedLands: string;
  marketMultiplier: string;
  mcmmoMultiplier: string;
  virtualChests: string;
  fullServerAccess: boolean;
};

export type RankFaq = {
  question: string;
  answer: string;
};

export type Rank = {
  slug: RankSlug;
  name: string;
  badge: string;
  priceCents: number;
  price: string;
  duration: string;
  description: string;
  summaryBenefits: readonly string[];
  benefits: readonly string[];
  comparison: RankComparison;
  faq: readonly RankFaq[];
  featured?: boolean;
};

export function formatPrice(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError("Price must be a non-negative integer number of cents.");
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

const sharedFaq: readonly RankFaq[] = [
  {
    question: "O rank expira?",
    answer: "Não. Todos os ranks desta página são vitalícios e permanecem vinculados à conta informada quando a compra estiver disponível.",
  },
  {
    question: "Os benefícios funcionam no Java e no Bedrock?",
    answer: "Sim. Os benefícios são aplicados à sua conta dentro da rede SWIFT MC e funcionam nas versões Java e Bedrock suportadas.",
  },
  {
    question: "Já posso concluir a compra pelo site?",
    answer: "Ainda não. Nesta etapa você pode comparar os ranks e salvar sua seleção no carrinho local, sem enviar dados ou processar cobranças.",
  },
];

const rankCatalog: readonly Omit<Rank, "price">[] = [
  {
    slug: "vip",
    name: "VIP",
    badge: "Iniciante essencial",
    priceCents: 1990,
    duration: "Vitalício",
    description: "Vantagens vitais para expandir sua fazenda e sua sobrevivência no mapa.",
    summaryBenefits: [
      "Tag [VIP] no Chat e Tab",
      "Voo dentro do seu terreno (/fly)",
      "+3 terrenos extras protegidos",
      "Baú virtual portátil (/bau)",
    ],
    benefits: [
      "Tag [VIP] destacada no Chat e na lista de jogadores",
      "Comando /fly dentro dos seus próprios terrenos",
      "Três terrenos extras para proteger suas construções",
      "Acesso ao baú virtual portátil com /bau",
      "Kit VIP mensal para apoiar sua progressão",
      "Prioridade no suporte da comunidade",
    ],
    comparison: {
      protectedLands: "+3",
      marketMultiplier: "Padrão",
      mcmmoMultiplier: "Padrão",
      virtualChests: "1",
      fullServerAccess: false,
    },
    faq: sharedFaq,
  },
  {
    slug: "vip-plus",
    name: "VIP+",
    badge: "Recomendado",
    priceCents: 3990,
    duration: "Vitalício",
    description: "Acelere sua economia com multiplicadores de moedas e utilidades remotas.",
    summaryBenefits: [
      "Todas as vantagens do VIP",
      "Utilitários /craft, /lixeira e /ec",
      "1.5x em vendas no mercado",
      "+8 terrenos e biomas exclusivos",
      "Kit mensal mítico e 5 baús virtuais",
    ],
    benefits: [
      "Todos os benefícios permanentes do rank VIP",
      "Acesso remoto aos comandos /craft, /lixeira e /ec",
      "Multiplicador de 1.5x nas vendas realizadas no mercado",
      "Oito terrenos adicionais com acesso a biomas exclusivos",
      "Kit Survival Mítico entregue mensalmente",
      "Cinco baús virtuais para organizar recursos e itens raros",
      "Teleporte com tempo de espera reduzido",
      "Tag [VIP+] exclusiva no Chat e na lista de jogadores",
    ],
    comparison: {
      protectedLands: "+8",
      marketMultiplier: "1.5x",
      mcmmoMultiplier: "Padrão",
      virtualChests: "5",
      fullServerAccess: false,
    },
    faq: sharedFaq,
    featured: true,
  },
  {
    slug: "mvp",
    name: "MVP",
    badge: "Patente máxima",
    priceCents: 6990,
    duration: "Vitalício",
    description: "O ápice da prosperidade e do prestígio para jogadores e fundadores de clãs.",
    summaryBenefits: [
      "Todas as vantagens do VIP+",
      "Entrada mesmo com servidor lotado",
      "2x XP mcMMO e coins",
      "Mundo dos Deuses e Mina VIP",
      "15 terrenos e tag customizada",
    ],
    benefits: [
      "Todos os benefícios permanentes dos ranks VIP e VIP+",
      "Entrada garantida mesmo quando o servidor estiver lotado",
      "Multiplicador global de 2x para XP mcMMO e coins",
      "Acesso ao Mundo dos Deuses e à Mina VIP exclusiva",
      "Quinze terrenos adicionais de grandes dimensões",
      "Tag customizada para destacar sua identidade na comunidade",
      "Kit MVP mensal com recursos de alto nível",
      "Prioridade máxima no suporte da equipe",
    ],
    comparison: {
      protectedLands: "+15",
      marketMultiplier: "2x",
      mcmmoMultiplier: "2x",
      virtualChests: "5",
      fullServerAccess: true,
    },
    faq: sharedFaq,
  },
] as const;

export const ranks: readonly Rank[] = rankCatalog.map((rank) => ({
  ...rank,
  price: formatPrice(rank.priceCents),
}));

export function getRank(slug: string): Rank | undefined {
  return ranks.find((rank) => rank.slug === slug);
}
