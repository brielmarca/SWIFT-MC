export type RankSlug = "swift" | "eclipse" | "cosmic" | "overdrive";

export type KitItem = {
  quantity: number;
  name: string;
  enchantments?: readonly string[];
};

export type Kit = {
  cooldown: string;
  items: readonly KitItem[];
  money?: number;
  claimBlocks?: number;
  mcmmoXp?: number;
};

export type RankComparison = {
  homes: number;
  mcmmoXpBonus: string;
  portableWorkstations: string;
  monthlyClaimBlocks: number;
  monthlyMoney: number;
};

export type RankFaq = {
  question: string;
  answer: string;
};

export type Rank = {
  slug: RankSlug;
  name: string;
  badge: string;
  priceCents: number | null;
  price: string | null;
  duration: string;
  description: string;
  summaryBenefits: readonly string[];
  benefits: readonly string[];
  inheritsFrom: RankSlug | null;
  dailyKit: Kit;
  weeklyKit: Kit;
  monthlyKit: Kit;
  welcomeKit: Kit;
  comparison: RankComparison;
  faq: readonly RankFaq[];
  featured?: boolean;
};

export function formatPrice(cents: number | null): string | null {
  if (cents === null || cents < 0 || !Number.isInteger(cents)) {
    return null;
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
  {
    question: "Como resgato os kits?",
    answer: "Digite /vip ou use o item 'MENU VIP' na sua barra para abrir o menu dos kits. Clique no kit para resgatar. Cada kit tem o seu tempo de espera.",
  },
  {
    question: "Os kits e vantagens ativam automaticamente?",
    answer: "Sim. Os kits e vantagens são ativados automaticamente após a compra.",
  },
];

const swiftDailyKit: Kit = {
  cooldown: "24 horas",
  items: [
    { quantity: 16, name: "Bife cozido" },
    { quantity: 8, name: "Cenoura dourada" },
    { quantity: 8, name: "Garrafa de XP" },
    { quantity: 16, name: "Tocha" },
  ],
  money: 300,
};

const swiftWeeklyKit: Kit = {
  cooldown: "7 dias",
  items: [
    { quantity: 1, name: "Picareta de ferro", enchantments: ["Eficiência 2", "Inquebrável 2"] },
    { quantity: 1, name: "Machado de ferro", enchantments: ["Eficiência 2", "Inquebrável 2"] },
    { quantity: 1, name: "Pá de ferro", enchantments: ["Eficiência 2", "Inquebrável 2"] },
    { quantity: 64, name: "Tronco de carvalho" },
    { quantity: 32, name: "Bife cozido" },
    { quantity: 16, name: "Garrafa de XP" },
  ],
  money: 1000,
  claimBlocks: 250,
};

const swiftMonthlyKit: Kit = {
  cooldown: "30 dias",
  items: [
    { quantity: 1, name: "Capacete de ferro", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Peitoral de ferro", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Calças de ferro", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Botas de ferro", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Espada de ferro", enchantments: ["Proteção 2", "Afiação 2", "Inquebrável 2"] },
    { quantity: 4, name: "Maçã dourada" },
    { quantity: 64, name: "Bife cozido" },
    { quantity: 32, name: "Garrafa de XP" },
  ],
  money: 3000,
  claimBlocks: 1000,
};

const swiftWelcomeKit: Kit = {
  cooldown: "Resgate único",
  items: [
    { quantity: 1, name: "Shulker box" },
    { quantity: 64, name: "Garrafa de XP" },
    { quantity: 8, name: "Maçã dourada" },
  ],
  money: 2000,
  claimBlocks: 500,
};

const eclipseDailyKit: Kit = {
  cooldown: "24 horas",
  items: [
    { quantity: 32, name: "Bife cozido" },
    { quantity: 2, name: "Maçã dourada" },
    { quantity: 16, name: "Garrafa de XP" },
    { quantity: 8, name: "Barra de ferro" },
  ],
  money: 700,
};

const eclipseWeeklyKit: Kit = {
  cooldown: "7 dias",
  items: [
    { quantity: 1, name: "Picareta de diamante", enchantments: ["Eficiência 3", "Inquebrável 2"] },
    { quantity: 1, name: "Machado de diamante", enchantments: ["Eficiência 3", "Inquebrável 2"] },
    { quantity: 1, name: "Pá de diamante", enchantments: ["Eficiência 3", "Inquebrável 2"] },
    { quantity: 16, name: "Barra de ferro" },
    { quantity: 4, name: "Diamante" },
    { quantity: 48, name: "Bife cozido" },
    { quantity: 32, name: "Garrafa de XP" },
  ],
  money: 2500,
  claimBlocks: 750,
};

const eclipseMonthlyKit: Kit = {
  cooldown: "30 dias",
  items: [
    { quantity: 1, name: "Capacete de diamante", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Peitoral de diamante", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Calças de diamante", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Botas de diamante", enchantments: ["Proteção 2", "Inquebrável 2"] },
    { quantity: 1, name: "Espada de diamante", enchantments: ["Proteção 2", "Afiação 2", "Inquebrável 2"] },
    { quantity: 8, name: "Maçã dourada" },
    { quantity: 64, name: "Bife cozido" },
    { quantity: 48, name: "Garrafa de XP" },
  ],
  money: 8000,
  claimBlocks: 3000,
};

const eclipseWelcomeKit: Kit = {
  cooldown: "Resgate único",
  items: [
    { quantity: 1, name: "Shulker box" },
    { quantity: 64, name: "Garrafa de XP" },
    { quantity: 2, name: "Maçã dourada encantada" },
    { quantity: 2, name: "Bloco de diamante" },
  ],
  money: 6000,
  claimBlocks: 1500,
};

const cosmicDailyKit: Kit = {
  cooldown: "24 horas",
  items: [
    { quantity: 48, name: "Bife cozido" },
    { quantity: 8, name: "Maçã dourada" },
    { quantity: 24, name: "Garrafa de XP" },
    { quantity: 2, name: "Diamante" },
  ],
  money: 1500,
  mcmmoXp: 500,
};

const cosmicWeeklyKit: Kit = {
  cooldown: "7 dias",
  items: [
    { quantity: 1, name: "Picareta de diamante", enchantments: ["Eficiência 4", "Inquebrável 3", "Fortuna 2"] },
    { quantity: 1, name: "Machado de diamante", enchantments: ["Eficiência 4", "Inquebrável 3"] },
    { quantity: 1, name: "Pá de diamante", enchantments: ["Eficiência 4", "Inquebrável 3"] },
    { quantity: 8, name: "Diamante" },
    { quantity: 8, name: "Maçã dourada" },
    { quantity: 48, name: "Garrafa de XP" },
  ],
  money: 5000,
  claimBlocks: 2000,
  mcmmoXp: 1500,
};

const cosmicMonthlyKit: Kit = {
  cooldown: "30 dias",
  items: [
    { quantity: 1, name: "Capacete de diamante", enchantments: ["Proteção 3", "Inquebrável 3", "Respiração", "Queda leve"] },
    { quantity: 1, name: "Peitoral de diamante", enchantments: ["Proteção 3", "Inquebrável 3", "Respiração", "Queda leve"] },
    { quantity: 1, name: "Calças de diamante", enchantments: ["Proteção 3", "Inquebrável 3", "Respiração", "Queda leve"] },
    { quantity: 1, name: "Botas de diamante", enchantments: ["Proteção 3", "Inquebrável 3", "Respiração", "Queda leve"] },
    { quantity: 1, name: "Espada de diamante", enchantments: ["Afiação 3", "Saque 2"] },
    { quantity: 2, name: "Livro de Remendo" },
    { quantity: 1, name: "Maçã dourada encantada" },
    { quantity: 16, name: "Maçã dourada" },
    { quantity: 64, name: "Garrafa de XP" },
  ],
  money: 20000,
  claimBlocks: 8000,
};

const cosmicWelcomeKit: Kit = {
  cooldown: "Resgate único",
  items: [
    { quantity: 1, name: "Shulker box" },
    { quantity: 1, name: "Livro de Remendo" },
    { quantity: 4, name: "Maçã dourada encantada" },
    { quantity: 4, name: "Bloco de diamante" },
    { quantity: 1, name: "Totem da imortalidade" },
  ],
  money: 15000,
  claimBlocks: 4000,
};

const overdriveDailyKit: Kit = {
  cooldown: "24 horas",
  items: [
    { quantity: 64, name: "Bife cozido" },
    { quantity: 16, name: "Maçã dourada" },
    { quantity: 2, name: "Maçã dourada encantada" },
    { quantity: 48, name: "Garrafa de XP" },
    { quantity: 4, name: "Diamante" },
    { quantity: 8, name: "Pérola do fim" },
  ],
  money: 3000,
  mcmmoXp: 1500,
};

const overdriveWeeklyKit: Kit = {
  cooldown: "7 dias",
  items: [
    { quantity: 1, name: "Picareta de netherite", enchantments: ["Eficiência 5", "Inquebrável 3", "Remendo", "Fortuna 3"] },
    { quantity: 1, name: "Machado de netherite", enchantments: ["Eficiência 5", "Inquebrável 3", "Remendo", "Afiação 5"] },
    { quantity: 1, name: "Pá de netherite", enchantments: ["Eficiência 5", "Inquebrável 3", "Remendo"] },
    { quantity: 32, name: "Diamante" },
    { quantity: 4, name: "Fragmento de netherite" },
    { quantity: 4, name: "Maçã dourada encantada" },
    { quantity: 64, name: "Garrafa de XP" },
  ],
  money: 10000,
  claimBlocks: 5000,
  mcmmoXp: 5000,
};

const overdriveMonthlyKit: Kit = {
  cooldown: "30 dias",
  items: [
    { quantity: 1, name: "Capacete de netherite", enchantments: ["Proteção 4", "Inquebrável 3", "Remendo"] },
    { quantity: 1, name: "Peitoral de netherite", enchantments: ["Proteção 4", "Inquebrável 3", "Remendo"] },
    { quantity: 1, name: "Calças de netherite", enchantments: ["Proteção 4", "Inquebrável 3", "Remendo"] },
    { quantity: 1, name: "Botas de netherite", enchantments: ["Proteção 4", "Inquebrável 3", "Remendo"] },
    { quantity: 1, name: "Espada de netherite", enchantments: ["Afiação 5", "Saque 3"] },
    { quantity: 1, name: "Arco", enchantments: ["Remendo"] },
    { quantity: 1, name: "Escudo", enchantments: ["Remendo"] },
    { quantity: 1, name: "Elytra", enchantments: ["Remendo"] },
    { quantity: 64, name: "Foguete" },
    { quantity: 64, name: "Flecha" },
    { quantity: 2, name: "Totem da imortalidade" },
    { quantity: 1, name: "Beacon" },
    { quantity: 8, name: "Maçã dourada encantada" },
    { quantity: 64, name: "Garrafa de XP" },
  ],
  money: 50000,
  claimBlocks: 20000,
};

const overdriveWelcomeKit: Kit = {
  cooldown: "Resgate único",
  items: [
    { quantity: 1, name: "Shulker box" },
    { quantity: 4, name: "Lingote de netherite" },
    { quantity: 8, name: "Maçã dourada encantada" },
    { quantity: 3, name: "Totem da imortalidade" },
    { quantity: 64, name: "Garrafa de XP" },
  ],
  money: 40000,
  claimBlocks: 10000,
};

const rankCatalog: readonly Omit<Rank, "price">[] = [
  {
    slug: "swift",
    name: "Swift",
    badge: "Essencial",
    priceCents: null,
    duration: "Vitalício",
    description: "Vantagens vitais para expandir sua fazenda e sua sobrevivência no mapa. A porta de entrada para a experiência VIP.",
    summaryBenefits: [
      "Tag [SWIFT] no Chat",
      "3 homes para teleporte",
      "Mesa de trabalho portátil (/workbench)",
      "+10% XP no mcMMO",
    ],
    benefits: [
      "Tag exclusiva [SWIFT] no chat",
      "3 homes (casas) para se teleportar",
      "Mesa de trabalho portátil: /workbench",
      "+10% de XP no mcMMO",
      "Kit Diário a cada 24 horas",
      "Kit Semanal a cada 7 dias",
      "Kit Mensal a cada 30 dias",
      "Kit de Boas-vindas (resgate único)",
    ],
    inheritsFrom: null,
    dailyKit: swiftDailyKit,
    weeklyKit: swiftWeeklyKit,
    monthlyKit: swiftMonthlyKit,
    welcomeKit: swiftWelcomeKit,
    comparison: {
      homes: 3,
      mcmmoXpBonus: "+10%",
      portableWorkstations: "Mesa de trabalho",
      monthlyClaimBlocks: 1000,
      monthlyMoney: 3000,
    },
    faq: sharedFaq,
  },
  {
    slug: "eclipse",
    name: "Eclipse",
    badge: "Intermediário",
    priceCents: null,
    duration: "Vitalício",
    description: "Tudo do Swift + utilidades remotas, mais homes e XP aumentado. Ideal para quem quer mais conveniência no Survival.",
    summaryBenefits: [
      "Todas as vantagens do Swift",
      "5 homes para teleporte",
      "Baú do fim portátil (/enderchest)",
      "Bigorna portátil (/anvil)",
      "+25% XP no mcMMO",
    ],
    benefits: [
      "Todos os benefícios permanentes do rank Swift",
      "5 homes (casas) para se teleportar",
      "Baú do fim portátil: /enderchest",
      "Bigorna portátil: /anvil",
      "/hat: use qualquer item como chapéu",
      "/back também funciona ao morrer: volte ao local da morte",
      "+25% de XP no mcMMO",
      "Tag exclusiva [ECLIPSE] no chat",
      "Kit Diário a cada 24 horas",
      "Kit Semanal a cada 7 dias",
      "Kit Mensal a cada 30 dias",
      "Kit de Boas-vindas (resgate único)",
    ],
    inheritsFrom: "swift",
    dailyKit: eclipseDailyKit,
    weeklyKit: eclipseWeeklyKit,
    monthlyKit: eclipseMonthlyKit,
    welcomeKit: eclipseWelcomeKit,
    comparison: {
      homes: 5,
      mcmmoXpBonus: "+25%",
      portableWorkstations: "Mesa de trabalho, Baú do fim, Bigorna",
      monthlyClaimBlocks: 3000,
      monthlyMoney: 8000,
    },
    faq: sharedFaq,
    featured: true,
  },
  {
    slug: "cosmic",
    name: "Cosmic",
    badge: "Avançado",
    priceCents: null,
    duration: "Vitalício",
    description: "Tudo do Eclipse + bancadas portáteis completas, nick colorido, teleporte sem espera. Para jogadores dedicados.",
    summaryBenefits: [
      "Todas as vantagens do Eclipse",
      "8 homes para teleporte",
      "Todas as bancadas portáteis",
      "/nick com cores",
      "Teleporte sem tempo de espera",
      "+50% XP no mcMMO",
    ],
    benefits: [
      "Todos os benefícios permanentes do rank Eclipse",
      "8 homes (casas) para se teleportar",
      "Bancadas portáteis: mesa de ferreiro, cortador de pedra, tear, pedra de amolar e mesa de cartografia",
      "/nick: escolha seu apelido com cores",
      "Chat colorido",
      "Teleporte sem tempo de espera",
      "+50% de XP no mcMMO",
      "Tag exclusiva [COSMIC] no chat",
      "Kit Diário a cada 24 horas",
      "Kit Semanal a cada 7 dias",
      "Kit Mensal a cada 30 dias",
      "Kit de Boas-vindas (resgate único)",
    ],
    inheritsFrom: "eclipse",
    dailyKit: cosmicDailyKit,
    weeklyKit: cosmicWeeklyKit,
    monthlyKit: cosmicMonthlyKit,
    welcomeKit: cosmicWelcomeKit,
    comparison: {
      homes: 8,
      mcmmoXpBonus: "+50%",
      portableWorkstations: "Todas (Ferreiro, Cortador, Tear, Amolar, Cartografia)",
      monthlyClaimBlocks: 8000,
      monthlyMoney: 20000,
    },
    faq: sharedFaq,
  },
  {
    slug: "overdrive",
    name: "Overdrive",
    badge: "Máximo",
    priceCents: null,
    duration: "Vitalício",
    description: "O ápice da experiência VIP. Tudo do Cosmic + cura, teleporte sem cooldown, 2x mcMMO, kits de netherite, elytra e beacon.",
    summaryBenefits: [
      "Todas as vantagens do Cosmic",
      "12 homes para teleporte",
      "/heal (1x por hora)",
      "Teleporte sem cooldown",
      "2x XP no mcMMO",
      "Kits com netherite, elytra e beacon",
    ],
    benefits: [
      "Todos os benefícios permanentes do rank Cosmic",
      "12 homes (casas) para se teleportar",
      "/heal: recupera toda a vida (1 vez por hora)",
      "Teleporte sem tempo de espera e sem cooldown",
      "XP em dobro (2x) no mcMMO",
      "Tag exclusiva [OVERDRIVE] no chat",
      "Os kits mais fortes do servidor: netherite, elytra, beacon e muito mais",
      "Kit Diário a cada 24 horas",
      "Kit Semanal a cada 7 dias",
      "Kit Mensal a cada 30 dias",
      "Kit de Boas-vindas (resgate único)",
    ],
    inheritsFrom: "cosmic",
    dailyKit: overdriveDailyKit,
    weeklyKit: overdriveWeeklyKit,
    monthlyKit: overdriveMonthlyKit,
    welcomeKit: overdriveWelcomeKit,
    comparison: {
      homes: 12,
      mcmmoXpBonus: "2x",
      portableWorkstations: "Todas",
      monthlyClaimBlocks: 20000,
      monthlyMoney: 50000,
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