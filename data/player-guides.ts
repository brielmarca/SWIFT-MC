export type GuideEntry = { id: string; category: string; title: string; body: string };

export const rules: readonly GuideEntry[] = [
  { id: "R01", category: "Convivência", title: "Respeite os outros jogadores", body: "Não pratique assédio, discriminação, ameaças ou ataques pessoais. Respeite a equipe e as diferenças entre os membros da comunidade." },
  { id: "R02", category: "Convivência", title: "Cuide do chat", body: "Evite spam, flood e mensagens ofensivas. Não divulgue links maliciosos ou propaganda sem autorização da equipe." },
  { id: "R03", category: "Jogo justo", title: "Não use trapaças", body: "Não utilize hacks, x-ray, bots ou modificações que ofereçam vantagem injusta. Em caso de dúvida sobre um mod, consulte a equipe antes de usá-lo." },
  { id: "R04", category: "Jogo justo", title: "Reporte falhas", body: "Não explore bugs, duplicações ou falhas da economia. Informe o problema à equipe de forma privada e não compartilhe instruções para abusar dele." },
  { id: "R05", category: "Terrenos e economia", title: "Respeite construções e recursos", body: "Não destrua construções de outros jogadores nem contorne proteções. Peça autorização antes de alterar um terreno compartilhado ou retirar recursos de outra pessoa." },
  { id: "R06", category: "Terrenos e economia", title: "Negocie com transparência", body: "Cumpra os acordos feitos nas trocas. Não use informações falsas ou se passe por outra pessoa para obter itens, moedas ou acesso a terrenos." },
  { id: "R07", category: "Segurança e suporte", title: "Proteja dados pessoais", body: "Não publique dados pessoais de terceiros. Nunca peça senhas, códigos de acesso ou informações privadas de outros jogadores." },
  { id: "R08", category: "Segurança e suporte", title: "Use os canais de suporte", body: "Relate conflitos à equipe com contexto, nomes e evidências disponíveis. Não faça denúncias falsas nem tente resolver disputas com ameaças ou retaliações." },
];

export const faqs: readonly GuideEntry[] = [
  { id: "como-entrar", category: "Servidor", title: "Como entro no servidor?", body: "Na página Jogar, copie o endereço e confira a versão. No Minecraft Java, abra Multijogador → Adicionar servidor e cole o endereço completo." },
  { id: "versao", category: "Servidor", title: "Qual versão do Minecraft devo usar?", body: "As páginas Jogar e Status exibem a versão retornada pelo servidor. Se ela não estiver disponível ou houver dúvida sobre compatibilidade, procure o suporte no Discord." },
  { id: "offline", category: "Servidor", title: "O servidor aparece offline. O que fazer?", body: "Aguarde um pouco e atualize a página Status. Uma consulta indisponível pode indicar manutenção ou falha de conexão. Consulte os avisos da comunidade antes de tentar novamente." },
  { id: "conta-site", category: "Conta", title: "Preciso criar uma conta no site?", body: "Não é necessário criar uma conta no site para consultar informações, explorar ranks ou usar o carrinho local. O site não oferece cadastro ou login. O Discord é usado apenas como comunidade e canal de suporte." },
  { id: "seguranca-conta", category: "Conta", title: "Como protejo minha conta?", body: "Use os recursos de segurança da sua conta Minecraft e nunca compartilhe senhas ou códigos de acesso. Para problemas de acesso à conta, utilize o suporte oficial responsável por ela." },
  { id: "beneficios-vip", category: "VIPs", title: "Onde vejo os benefícios dos VIPs?", body: "A loja apresenta os ranks e seus benefícios. Abra os detalhes de um rank para consultar a duração, as vantagens e a comparação entre níveis." },
  { id: "carrinho-vip", category: "VIPs", title: "Adicionar um VIP ao carrinho ativa o rank?", body: "Não. O carrinho guarda apenas sua seleção neste navegador. Ele não cria uma compra nem ativa benefícios no servidor. A conclusão de compras está pausada." },
  { id: "carrinho-dispositivo", category: "VIPs", title: "Meu carrinho aparece em outro dispositivo?", body: "Não. A seleção é armazenada localmente no navegador utilizado. Limpar os dados do navegador também pode remover o carrinho." },
  { id: "contato", category: "Suporte", title: "Como falo com a equipe?", body: "Use o link do Discord oficial disponível no site para entrar na comunidade e falar com a equipe de suporte." },
  { id: "denuncia", category: "Suporte", title: "Como reporto um problema ou violação das regras?", body: "Entre em contato com a equipe no Discord e descreva o ocorrido, incluindo horário, nomes e evidências disponíveis. Não envie senhas nem dados pessoais sensíveis." },
];

export function filterGuides(entries: readonly GuideEntry[], query: string, category: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const words = normalize(query.trim()).split(/\s+/).filter(Boolean);
  return entries.filter((entry) => (category === "Todas" || entry.category === category) && words.every((word) => normalize(`${entry.id} ${entry.title} ${entry.body} ${entry.category}`).includes(word)));
}
