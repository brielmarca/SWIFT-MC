import { publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContentPage } from "@/components/content/content-page";
import { RulesGuide } from "@/components/rules-guide";

export const metadata = publicPageMetadata("/rules");

export default function RulesPage() {
  return <ContentPage active="/rules" title="Regras do SwiftMC" description="Consulte os regulamentos oficiais do servidor e do Discord. Busque por assunto ou ID e compartilhe links diretos das regras.">
    <RulesGuide />
    <nav aria-label="Dúvidas sobre as regras" className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
      <Link href="/faq#denuncia" className="network-action">Como reportar um problema <ArrowUpRight size={16} aria-hidden="true" /></Link>
      <Link href="/faq" className="network-action">Perguntas frequentes <ArrowUpRight size={16} aria-hidden="true" /></Link>
    </nav>
  </ContentPage>;
}
