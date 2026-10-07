import type { WikiGuide } from "./types";

/**
 * SAMPLE CONTENT — replace these entries with real guides before production.
 * Rules: stable URL-safe `slug`, category from WIKI_CATEGORIES, section `id`
 * unique per guide (becomes the #anchor), internal `links` hrefs start with "/",
 * `status: "draft"` hides a guide, optional `related` slugs must point at
 * existing guides (unknown slugs are ignored at render time).
 */
export const wikiGuides: readonly WikiGuide[] = [
  {
    slug: "como-entrar-no-servidor",
    title: "Como entrar no servidor",
    category: "Primeiros passos",
    description: "Do endereço do servidor ao primeiro login: tudo o que você precisa para começar a jogar no SWIFT MC no Minecraft Java.",
    tags: ["inicio", "multijogador", "endereco"],
    related: ["comandos-essenciais", "guia-do-survival"],
    featured: true,
    sections: [
      {
        id: "antes-de-comecar",
        title: "Antes de começar",
        blocks: [
          { type: "paragraph", text: "O SWIFT MC roda no Minecraft Java Edition. Antes de abrir o jogo, confira a versão e o status do servidor nas páginas oficiais — se o servidor estiver offline, nenhuma configuração vai funcionar." },
          { type: "bullets", items: [
            "Uma conta Minecraft Java válida, usada para entrar no servidor.",
            "A versão do jogo exibida na página de Status, para evitar incompatibilidade.",
            "As regras do servidor lidas pelo menos uma vez, para não cair na área de moderação.",
          ] },
          { type: "callout", kind: "info", title: "Onde ficam as informações oficiais", text: "Endereço, versão e contagem de jogadores ficam nas páginas Jogar e Status. Use sempre essas fontes antes de suspeitar de problema na sua conexão." },
        ],
      },
      {
        id: "passo-a-passo",
        title: "Passo a passo",
        blocks: [
          { type: "steps", items: [
            "Abra o Minecraft Java e escolha Multijogador no menu principal.",
            "Clique em Adicionar servidor e escolha um nome de fácil identificação.",
            "Cole o endereço do SWIFT MC no campo Endereço do servidor.",
            "Salve, selecione o servidor na lista e clique em Entrar no servidor.",
          ] },
          { type: "links", items: [
            { href: "/play", label: "Página Jogar", description: "Copie o endereço pronto e confira o status em tempo real" },
            { href: "/status", label: "Página Status", description: "Versão, jogador online e endereço público do servidor" },
          ] },
        ],
      },
      {
        id: "primeiros-minutos",
        title: "Primeiros minutos no servidor",
        blocks: [
          { type: "paragraph", text: "Ao entrar, você aparece no spawn. Leia o aviso fixado no chat e use os comandos básicos para se localizar antes de sair explorando." },
          { type: "command", command: "/help", note: "Lista os comandos disponíveis e suas categorias." },
          { type: "command", command: "/spawn", note: "Retorna você ao spawn do servidor a qualquer momento." },
          { type: "bullets", items: [
            "Leia as regras antes de construir: elas valem desde o primeiro minuto.",
            "Escolha um ponto afiado para sua base e marque o endereço com /sethome.",
            "Diga olá no chat — a comunidade ajuda quem está começando.",
          ] },
        ],
      },
      {
        id: "duvidas-comuns",
        title: "Dúvidas comuns",
        blocks: [
          { type: "paragraph", text: "Se a conexão falhar, o endereço parecer errado ou sua dúvida for sobre contas, VIPs ou suporte, confira as respostas rápidas ou avance para os guias completos." },
          { type: "links", items: [
            { href: "/faq", label: "Perguntas frequentes", description: "Versão, conta, VIPs e suporte em formato curto" },
            { href: "/rules", label: "Regras do servidor", description: "Convivência, jogo justo, terrenos e segurança" },
            { href: "/wiki/comandos-essenciais", label: "Guia: Comandos essenciais", description: "Chat, teleporte e economia em um só lugar" },
          ] },
        ],
      },
    ],
  },
  {
    slug: "comandos-essenciais",
    title: "Comandos essenciais",
    category: "Comandos",
    description: "Os comandos que você mais usa no dia a dia: teleporte, casa, chat e economia, com exemplos prontos para copiar.",
    tags: ["comandos", "chat", "teleporte"],
    related: ["como-entrar-no-servidor", "como-funciona-a-economia"],
    featured: true,
    sections: [
      {
        id: "como-usar",
        title: "Como usar os comandos",
        blocks: [
          { type: "paragraph", text: "Comandos digitam-se no chat do Minecraft começando com barra (/). Ao digitar parte do comando, o próprio jogo sugere opções — use Tab para completar. Nenhum comando abaixo executa nada fora do seu jogo; eles só funcionam digitados no chat do servidor." },
          { type: "callout", kind: "warning", title: "Comandos não pedem sua senha", text: "Nenhum comando, chat ou pessoa do servidor pode pedir sua senha ou códigos de acesso. Se alguém pedir, ignore e reporte à equipe." },
        ],
      },
      {
        id: "movimentacao",
        title: "Movimentação e casas",
        blocks: [
          { type: "command", command: "/sethome", note: "Marca sua posição atual como casa principal." },
          { type: "command", command: "/home", note: "Teleporta você para a casa marcada." },
          { type: "command", command: "/spawn", note: "Volta ao spawn do servidor." },
          { type: "command", command: "/tpa <jogador>", note: "Envia um pedido de teleporte para outro jogador. Ele precisa aceitar." },
        ],
      },
      {
        id: "chat-e-economia",
        title: "Chat e economia",
        blocks: [
          { type: "command", command: "/msg <jogador> <mensagem>", note: "Mensagem privada visível apenas para o destinatário." },
          { type: "command", command: "/bal", note: "Consulta o seu saldo de moedas." },
          { type: "command", command: "/pay <jogador> <valor>", note: "Transfere moedas para outro jogador." },
          { type: "table", caption: "Atalhos mais usados", headers: ["Comando", "O que faz", "Exemplo"], rows: [
            ["/sethome", "Marca sua casa", "/sethome base"],
            ["/home", "Vai para sua casa", "/home"],
            ["/tpa", "Pede teleporte", "/tpa Steve"],
            ["/bal", "Consulta o saldo", "/bal"],
            ["/pay", "Paga outro jogador", "/pay Alex 100"],
          ] },
        ],
      },
      {
        id: "quando-pedir-ajuda",
        title: "Quando pedir ajuda",
        blocks: [
          { type: "paragraph", text: "Se um comando não funcionar, confira a versão do servidor na página Status e consulte a FAQ antes de reportar. Dúvidas sobre regras têm página própria." },
          { type: "links", items: [
            { href: "/faq", label: "FAQ", description: "Respostas rápidas sobre comandos, conta e suporte" },
            { href: "/rules", label: "Regras", description: "O que é permitido usar em partidas e no chat" },
          ] },
        ],
      },
    ],
  },
  {
    slug: "como-funciona-a-economia",
    title: "Como funciona a economia",
    category: "Economia",
    description: "Moedas, negociações entre jogadores e o papel dos leilões: entenda o mercado do SWIFT MC sem cair em golpes.",
    tags: ["economia", "moedas", "leiloes"],
    related: ["como-funcionam-os-ranks", "guia-do-survival"],
    featured: true,
    sections: [
      {
        id: "visao-geral",
        title: "Visão geral",
        blocks: [
          { type: "paragraph", text: "A economia do SWIFT MC gira em torno de moedas ganhas jogando: missões, eventos e a própria sobrevivência alimentam o seu saldo. Não existe forma oficial de comprar moedas com dinheiro real — moedas se ganham no servidor e se trocam entre jogadores." },
          { type: "bullets", items: [
            "Seu saldo é individual e consultável a qualquer momento.",
            "Preços entre jogadores são definidos por oferta e demanda, sem tabela oficial.",
            "Leilões no spawn são o ponto de encontro para comprar e vender itens raros.",
          ] },
        ],
      },
      {
        id: "negociando",
        title: "Negociando com segurança",
        blocks: [
          { type: "paragraph", text: "Toda negociação combina duas pessoas: quem entrega o item ou moeda e quem paga. Combine o combinado no chat para deixar registro e prefira os locais movimentados do spawn." },
          { type: "callout", kind: "warning", title: "Golpes comuns", text: "Desconfie de quem promete moedas fora do servidor, pede pagamento adiantado sem entrega ou se passa por um membro da equipe. Combine tudo no chat e reporte propostas estranhas." },
          { type: "bullets", items: [
            "Confirme o nome exato do jogador antes de transferir moedas.",
            "Nunca informe senha, e-mail ou códigos de acesso — a equipe jamais pede isso.",
            "Acordos combinados no chat valem: cumprir o combinado é regra da comunidade.",
          ] },
        ],
      },
      {
        id: "ferramentas",
        title: "Ferramentas do mercado",
        blocks: [
          { type: "table", caption: "Onde acompanhar a economia", headers: ["Ferramenta", "Serve para"], rows: [
            ["/bal", "Consultar seu saldo atual"],
            ["/pay", "Transferir moedas para outro jogador"],
            ["/leaderboards", "Ver quem mais acumula moedas no servidor"],
            ["Leilões no spawn", "Comprar e vender itens raros entre jogadores"],
          ] },
          { type: "links", items: [
            { href: "/leaderboards", label: "Ranking de moedas", description: "Posições de tempo de jogo, abates e economia" },
            { href: "/rules#R06", label: "Regra: negocie com transparência", description: "O que a equipe considera golpe dentro do jogo" },
            { href: "/wiki/como-funcionam-os-ranks", label: "Guia: Como funcionam os ranks", description: "O que muda para quem tem VIP — sem comprar moedas" },
          ] },
        ],
      },
    ],
  },
  {
    slug: "guia-do-survival",
    title: "Guia do Survival",
    category: "Survival",
    description: "Primeiros dias, base protegida e convívio com a comunidade: o roteiro essencial para sobreviver (e prosperar) no SWIFT MC.",
    tags: ["sobrevivencia", "base", "terrenos"],
    related: ["como-entrar-no-servidor", "comandos-essenciais"],
    sections: [
      {
        id: "primeiros-dias",
        title: "Primeiros dias",
        blocks: [
          { type: "steps", items: [
            "Colete madeira e faça ferramentas básicas antes de sair longe do spawn.",
            "Escolha um ponto com água e árvores para montar sua primeira base.",
            "Marque o local com /sethome para não se perder.",
            "Guarde o essencial em baú e mantenha comida sempre à mão.",
          ] },
          { type: "command", command: "/sethome base", note: "Exemplo: marca sua casa com o nome “base”." },
        ],
      },
      {
        id: "protegendo-seu-terreno",
        title: "Protegendo seu terreno",
        blocks: [
          { type: "paragraph", text: "Construções e recursos só ficam seguros quando o terreno está delimitado e as permissões estão corretas. Delimite cedo, revise quem tem acesso e peça autorização antes de mexer em área de outra pessoa." },
          { type: "callout", kind: "info", title: "Regra de ouro", text: "Não destrua construções de outros jogadores nem contorne proteções. Na dúvida, pergunte no chat antes de agir." },
          { type: "links", items: [
            { href: "/rules#R05", label: "Regra: respeite construções", description: "Delimitação, autorização e recursos compartilhados" },
            { href: "/wiki", label: "Wiki do servidor", description: "Guias de comandos, economia e primeiros passos" },
          ] },
        ],
      },
      {
        id: "crescendo",
        title: "Crescendo no servidor",
        blocks: [
          { type: "bullets", items: [
            "Participe dos eventos semanais para recompensas e contato com a comunidade.",
            "Use o ranking de tempo de jogo como referência de progresso, não como obrigação.",
            "Troque excedentes no spawn: o mercado entre jogadores é mais barado que qualquer loja.",
            "Convide amigos — servidores vivos fazem a diferença no Survival.",
          ] },
          { type: "links", items: [
            { href: "/events", label: "Próximos eventos", description: "Torneios, encontros e atividades da comunidade" },
            { href: "/online", label: "Jogadores online", description: "Veja quem está no servidor agora" },
          ] },
        ],
      },
    ],
  },
  {
    slug: "como-funcionam-os-ranks",
    title: "Como funcionam os ranks",
    category: "Ranks e VIPs",
    description: "O que os ranks oferecem, como funciona a seleção na loja e o que esperar da ativação — sem promessas e sem letras miúdas.",
    tags: ["vip", "loja", "ranks"],
    related: ["como-funciona-a-economia", "como-entrar-no-servidor"],
    sections: [
      {
        id: "o-que-sao-ranks",
        title: "O que são os ranks",
        blocks: [
          { type: "paragraph", text: "Os ranks VIP são opções voluntárias de apoio ao servidor: quem compra recebe benefícios de conveniência e cosméticos, e o valor ajuda a manter a estrutura online. Jogar sem rank é totalmente equivalente em termos de progressão — nada no Survival exige VIP." },
          { type: "bullets", items: [
            "Benefícios valem para a conta vinculada ao usuário comprado.",
            "Ranks superiores incluem tudo dos inferiores.",
            "Nenhum rank vende vantagem em combate: o jogo justo vale para todos.",
          ] },
        ],
      },
      {
        id: "como-obter",
        title: "Como obter um rank",
        blocks: [
          { type: "steps", items: [
            "Abra a Loja e compare os níveis, duração e benefícios de cada rank.",
            "Adicione a opção desejada ao carrinho — a seleção fica só neste navegador.",
            "Revise os dados do jogador antes de qualquer pagamento.",
            "Conclua a compra quando ela for reativada; a ativação segue os avisos oficiais.",
          ] },
          { type: "callout", kind: "warning", title: "Compras estão pausadas", text: "A conclusão de pagamentos está pausada nesta etapa. O carrinho é apenas uma seleção local: ele não ativa rank, não cobra nada e não cria pedido." },
          { type: "table", caption: "Perguntas rápidas", headers: ["Pergunta", "Resposta"], rows: [
            ["O carrinho ativa o rank?", "Não. Ele guarda a seleção neste navegador apenas."],
            ["Preciso de conta no site?", "Não para consultar a loja ou usar o carrinho."],
            ["O rank expira?", "Cada nível tem uma duração informada na página do rank."],
            ["Vantagem em PvP?", "Não. Ranks oferecem conveniência e cosméticos."],
          ] },
        ],
      },
      {
        id: "depois-da-compra",
        title: "Depois da compra",
        blocks: [
          { type: "paragraph", text: "Com a compra concluída (quando reativada), o benefício é aplicado na conta indicada na finalização. Prazos e confirmações são comunicados nos canais oficiais — desconfie de quem ofereça ativação por fora." },
          { type: "links", items: [
            { href: "/store", label: "Loja de ranks", description: "Compare níveis, benefícios e preços atuais" },
            { href: "/faq#beneficios-vip", label: "FAQ: benefícios dos VIPs", description: "Resposta rápida sobre o que cada rank oferece" },
            { href: "/faq#carrinho-vip", label: "FAQ: carrinho ativa o rank?", description: "Por que a seleção no carrinho não muda nada no servidor" },
          ] },
        ],
      },
    ],
  },
];
