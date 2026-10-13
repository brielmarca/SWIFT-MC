import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentPage } from "@/components/content/content-page";
import { SearchableGuide } from "@/components/searchable-guide";
import { rules } from "@/data/player-guides";

export const metadata: Metadata = { title: "Regras do servidor | SWIFT MC", description: "Consulte as regras de convivência, jogo justo e segurança da comunidade SWIFT MC." };

export default function RulesPage() {
  return <ContentPage active="/rules" title="Regras do servidor" description="Uma comunidade melhor começa com respeito e jogo justo. Encontre um assunto ou compartilhe o link direto de uma regra.">
    <SearchableGuide entries={rules} kind="rules" />
    <nav aria-label="Dúvidas sobre as regras" className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
      <Link href="/faq#denuncia" className="network-action">Como reportar um problema <ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link href="/faq" className="network-action">Perguntas frequentes <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </nav>
  </ContentPage>;
}
