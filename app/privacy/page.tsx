import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({ title: "Política de privacidade", description: "Estrutura da política de privacidade da Swift MC. Texto final pendente de aprovação.", path: "/privacy" });

export default function PrivacyPage() {
  return <ContentPage active="/faq" title="Política de privacidade" description="Estrutura da política de privacidade do site Swift MC. O texto final depende de aprovação do responsável pelo projeto.">
    <div className="space-y-4">
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Status</h2><p className="mt-3 text-sm leading-6 text-muted">Esta página existe para organização legal e transparência, mas o conteúdo jurídico final ainda não foi aprovado para publicação.</p></section>
      <section className="content-panel p-6"><h2 className="text-lg font-extrabold text-ink">Itens a definir</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-muted"><li>Controlador/responsável pelo tratamento e canal de contato.</li><li>Dados coletados por conta, compras, suporte e navegação.</li><li>Finalidades, bases legais, retenção e compartilhamento com provedores.</li><li>Direitos do titular e procedimento de solicitação.</li></ul></section>
    </div>
  </ContentPage>;
}
