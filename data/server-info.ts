export const serverInfo = {
  name: "Swift MC",
  edition: "Minecraft Java 1.21.11",
  defaultHost: "swiftmc.com",
  defaultPort: 25565,
  statusRefreshMs: 30000,
  connectionSteps: [
    { title: "Confira o servidor", description: "Veja o status e a versão informada pelo servidor nesta página antes de abrir o jogo." },
    { title: "Abra o Minecraft Java 1.21.11", description: "No launcher, selecione ou crie um perfil com a versão 1.21.11 antes de entrar no servidor." },
    { title: "Adicione o endereço", description: "Entre em Multijogador → Adicionar servidor. Escolha um nome e cole swiftmc.com no campo Endereço do servidor." },
    { title: "Entre e conheça a comunidade", description: "Salve, selecione o servidor e clique em Entrar no servidor. Leia as regras antes de começar sua jornada." },
  ],
} as const;

export const playerLinks = [
  { href: "/play", label: "Jogar" },
  { href: "/status", label: "Status" },
  { href: "/lore", label: "Lore" },
  { href: "/news", label: "Notícias" },
  { href: "/wiki", label: "Wiki" },
  { href: "/rules", label: "Regras" },
  { href: "/faq", label: "FAQ" },
  { href: "/status", label: "Status" },
] as const;
