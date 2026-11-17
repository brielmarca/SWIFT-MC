import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Política de reembolso", description: "Estrutura da política de reembolso da Swift MC. Texto final pendente de aprovação.", path: "/refund" });

export default function RefundPage() {
  return <ContentPage active="/faq" title="Política de reembolso" description="Estrutura da política de reembolso da Swift MC. O texto final depende de aprovação do responsável pelo projeto.">
    <div className="space-y-4">
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Status</h2><p className="mt-3 text-sm leading-6 text-muted">Esta página é uma estrutura preliminar para publicação futura. Não deve ser interpretada como política final aprovada.</p></section>
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Itens a definir</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Critérios de elegibilidade, prazos e forma de solicitação.</li><li>Tratamento de benefícios já entregues ou parcialmente utilizados.</li><li>Casos de indisponibilidade do serviço, duplicidade de cobrança e chargeback.</li><li>Canal de atendimento e informações necessárias para análise.</li></ul></section>
    </div>
  </ContentPage>;
}
