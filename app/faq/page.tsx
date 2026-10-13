import type { Metadata } from "next";
import Link from "next/link";
import { DiscordLink } from "@/components/discord-link";
import { BookOpen, MessageCircle } from "lucide-react";
import { ContentPage } from "@/components/content/content-page";
import { SearchableGuide } from "@/components/searchable-guide";
import { faqs } from "@/data/player-guides";

export const metadata: Metadata = { title: "Perguntas frequentes | SWIFT MC", description: "Tire suas dúvidas sobre o servidor, sua conta, VIPs e suporte." };

export default function FaqPage() {
  return <ContentPage active="/faq" title="Perguntas frequentes" description="Encontre respostas sobre o servidor, conta, VIPs e suporte. Busque um assunto ou escolha uma categoria.">
    <SearchableGuide entries={faqs} kind="faq" />
    <div className="mt-8 grid gap-3 border-t border-white/10 pt-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <section className="content-panel p-5 sm:p-6" aria-labelledby="wiki-guides-title">
      <BookOpen size={21} aria-hidden="true" className="mb-3 text-ultraviolet" />
      <h2 id="wiki-guides-title" className="text-lg font-extrabold text-ink">Guias completos na Wiki</h2>
      <p className="mt-2 text-sm leading-6 text-muted">Passo a passo detalhado para as dúvidas que pedem mais do que uma resposta curta.</p>
      <ul className="mt-5 flex flex-wrap gap-3">
        <li><Link href="/wiki/como-entrar-no-servidor" className="network-action">Como entrar no servidor</Link></li>
        <li><Link href="/wiki/comandos-essenciais" className="network-action">Comandos essenciais</Link></li>
        <li><Link href="/wiki" className="network-action">Ver toda a Wiki</Link></li>
      </ul>
    </section>
    <section className="content-panel border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-5 sm:p-6" aria-labelledby="faq-support-title"><MessageCircle size={21} aria-hidden="true" className="mb-3 text-ultraviolet" /><h2 id="faq-support-title" className="text-lg font-extrabold text-ink">Ainda precisa de ajuda?</h2><p className="mt-2 text-sm leading-6 text-muted">Converse com a equipe na comunidade oficial.</p><DiscordLink className="network-action mt-5">Suporte no Discord</DiscordLink></section>
    </div>
  </ContentPage>;
}
