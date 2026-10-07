export const serverInfo = {
  name: "SWIFT MC",
  edition: "Minecraft Java Edition",
  defaultHost: "play.swiftmc.net",
  defaultPort: 25565,
  statusRefreshMs: 30000,
  connectionSteps: [
    { title: "Confira o servidor", description: "Veja o status e a versão informada pelo servidor nesta página antes de abrir o jogo." },
    { title: "Abra o Minecraft Java", description: "No launcher, selecione uma versão compatível com a informada pelo servidor. Se a versão estiver indisponível, consulte a comunidade no Discord." },
    { title: "Adicione o endereço", description: "Entre em Multijogador → Adicionar servidor. Escolha um nome e cole o endereço copiado no campo Endereço do servidor, incluindo a porta quando exibida." },
    { title: "Entre e conheça a comunidade", description: "Salve, selecione o servidor e clique em Entrar no servidor. Leia as regras antes de começar sua jornada." },
  ],
} as const;

export const playerLinks = [
  { href: "/play", label: "Jogar" },
  { href: "/online", label: "Online" },
  { href: "/player", label: "Jogadores" },
  { href: "/leaderboards", label: "Ranking" },
  { href: "/news", label: "Novidades" },
  { href: "/events", label: "Eventos" },
  { href: "/wiki", label: "Wiki" },
  { href: "/rules", label: "Regras" },
  { href: "/faq", label: "FAQ" },
  { href: "/status", label: "Status" },
] as const;
