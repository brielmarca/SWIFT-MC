import type { Metadata } from "next";
import Link from "next/link";
import { DiscordLink } from "@/components/discord-link";
import { PlayerPage } from "@/components/player-page";
import { SearchableGuide } from "@/components/searchable-guide";
import { faqs } from "@/data/player-guides";

export const metadata: Metadata = { title: "Perguntas frequentes | SWIFT MC", description: "Tire suas dúvidas sobre o servidor, sua conta, VIPs e suporte." };

export default function FaqPage() {
  return <PlayerPage title="Perguntas frequentes" description="Encontre respostas sobre o servidor, conta, VIPs e suporte. Busque um assunto ou escolha uma categoria.">
    <SearchableGuide entries={faqs} kind="faq" />
    <section className="glass-panel mt-10 p-6" aria-labelledby="wiki-guides-title">
      <h2 id="wiki-guides-title" className="text-xl font-bold text-ink">Guias completos na Wiki</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Passo a passo detalhado para as dúvidas que pedem mais do que uma resposta curta.</p>
      <ul className="mt-5 flex flex-wrap gap-3">
        <li><Link href="/wiki/como-entrar-no-servidor" className="button-secondary">Como entrar no servidor</Link></li>
        <li><Link href="/wiki/comandos-essenciais" className="button-secondary">Comandos essenciais</Link></li>
        <li><Link href="/wiki" className="button-secondary">Ver toda a Wiki</Link></li>
      </ul>
    </section>
    <section className="glass-panel mt-10 p-6"><h2 className="text-xl font-bold text-ink">Ainda precisa de ajuda?</h2><p className="mt-2 text-sm leading-6 text-muted">Converse com a equipe na comunidade oficial.</p><DiscordLink className="button-secondary mt-5">Suporte no Discord</DiscordLink></section>
  </PlayerPage>;
}
