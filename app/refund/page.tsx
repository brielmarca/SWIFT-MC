import type { Metadata } from "next";
import Link from "next/link";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Cancelamentos e reembolsos",
  description: "Como solicitar cancelamento e acompanhar reembolso de pedidos da SwiftMC. Política em revisão.",
  path: "/refund",
});

export default function RefundPage() {
  return (
    <ContentPage active="/faq" title="Cancelamentos e reembolsos" description="Como pedir cancelamento de uma compra e o que acontece depois.">
      <div className="space-y-4 text-sm leading-7 text-muted">
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Solicitar cancelamento</h2>
          <p className="mt-3">Se você tem um pedido vinculado à sua conta, abra <Link href="/account/orders" className="font-semibold text-ultraviolet underline underline-offset-4">Meus pedidos</Link> e use o botão <strong className="text-ink">Solicitar cancelamento</strong>. O sistema registrará a solicitação, e você poderá acompanhar se ela foi recebida e analisada.</p>
          <p className="mt-2">O envio do formulário <strong className="text-ink">não estorna automaticamente o pagamento nem revoga benefícios</strong>. A equipe deve conferir o estado do pagamento, da entrega e do pedido antes de concluir o atendimento.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Direitos do consumidor</h2>
          <p className="mt-3">Nas contratações abrangidas pelo artigo 49 do Código de Defesa do Consumidor, o prazo de arrependimento é de 7 dias, conforme as condições legais. A análise de pedidos com benefícios digitais já entregues não deve eliminar direitos assegurados por lei.</p>
          <p className="mt-2">Reembolsos aprovados serão tratados pelo canal de pagamento correspondente, segundo a legislação aplicável e as condições do provedor. A interface atual não realiza reembolso automático.</p>
        </section>
        <section className="content-panel border border-amber-400/20 p-6">
          <h2 className="text-lg font-bold text-ink">Política operacional em revisão</h2>
          <p className="mt-3">Os critérios internos de atendimento, os prazos de resposta e os dados comerciais do fornecedor ainda dependem de aprovação. Esta página é informativa e não altera os direitos previstos em lei.</p>
        </section>
      </div>
    </ContentPage>
  );
}
