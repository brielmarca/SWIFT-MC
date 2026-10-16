import { regulations } from "./official-rules";

export type GuideEntry = { id: string; category: string; title: string; body: string };

export const rules: readonly GuideEntry[] = regulations.flatMap((regulation) => regulation.sections.flatMap((section) => section.blocks.map((block) => ({
  id: block.id,
  category: `${regulation.label} · ${section.title}`,
  title: block.paragraphs[0],
  body: block.paragraphs.slice(1).join("\n\n"),
}))));

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
