import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Termos de compra", description: "Estrutura dos termos de compra da Swift MC. Texto final pendente de aprovação.", path: "/terms" });

export default function TermsPage() {
  return <ContentPage active="/faq" title="Termos de compra" description="Estrutura dos termos de compra para produtos digitais da Swift MC. O texto final depende de aprovação.">
    <div className="space-y-4">
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Status</h2><p className="mt-3 text-sm leading-6 text-muted">As compras no site permanecem desativadas até validação final em homologação. Esta página é uma estrutura preliminar e não constitui texto jurídico aprovado.</p></section>
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Itens a definir</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Descrição dos produtos digitais, preços, duração e condições de ativação.</li><li>Identificação da conta/jogador beneficiado e requisitos técnicos (Minecraft Java 1.21.11).</li><li>Regras para indisponibilidade, manutenção, fraude, chargeback e suspensão por violação de regras.</li><li>Contato de suporte e canais oficiais para disputas.</li></ul></section>
    </div>
  </ContentPage>;
}
