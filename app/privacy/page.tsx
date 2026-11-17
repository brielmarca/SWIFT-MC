import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Aviso de Privacidade | Swift MC",
  description: "Transparência sobre dados tratados pela SwiftMC. Documento em revisão.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <ContentPage active="/faq" title="Aviso de privacidade" description="Informações iniciais sobre tratamento de dados pessoais na SwiftMC.">
      <div className="space-y-4 text-sm leading-7 text-muted">
        <section className="content-panel border border-amber-400/20 p-6">
          <h2 className="text-lg font-bold text-ink">Documento em revisão</h2>
          <p className="mt-3">Este aviso descreve o funcionamento identificado na plataforma, mas a identificação completa do controlador, prazos formais de retenção, canais para exercer direitos e a análise jurídica ainda precisam ser aprovados. A publicação desta página não significa que o processo de adequação à LGPD está concluído.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Quais dados o site trata</h2>
          <p className="mt-3">O cadastro pode envolver nome de exibição, e-mail, senha protegida por hash, telefone quando fornecido, identidades vinculadas, sessões, verificações de segurança e autenticação multifator. Pedidos podem conter nome de jogador Minecraft, produto, valor, histórico de status, referências de pagamentos e dados necessários à entrega de benefícios digitais.</p>
          <p className="mt-2">Registros técnicos e de auditoria são usados para segurança, prevenção de fraude, diagnóstico e atendimento.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Finalidades e fornecedores</h2>
          <p className="mt-3">Os dados apoiam autenticação, proteção de contas, processamento de pedidos, comunicação sobre serviços, prevenção de abuso e suporte. A aplicação utiliza infraestrutura de hospedagem, proteção de tráfego, banco de dados e integrações de pagamento, conforme os ambientes habilitados. Provedores de pagamento podem processar dados de cobrança em seus próprios fluxos.</p>
          <p className="mt-2">As hipóteses legais aplicáveis, os operadores efetivos e as transferências internacionais devem ser documentados pelo responsável antes da aprovação final desta política.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Direitos dos titulares</h2>
          <p className="mt-3">Conforme as condições da LGPD, você pode solicitar informações sobre tratamento, acesso, correção, exclusão quando cabível, portabilidade nas hipóteses aplicáveis e revogação de consentimentos opcionais. Algumas informações de pedidos e segurança podem exigir retenção para cumprimento de obrigações legais ou defesa de direitos.</p>
          <p className="mt-2">Para solicitações autenticadas, acesse <a href="/account/privacy" className="font-semibold text-ultraviolet underline underline-offset-4">Privacidade da minha conta</a>. Este canal permite registrar pedidos para análise, mas não realiza exportação ou exclusão automaticamente. A identificação e o contato público do controlador ainda precisam ser aprovados. Não envie documentos sensíveis no campo de descrição.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Cookies e armazenamento no navegador</h2>
          <p className="mt-3">Consulte a <a href="/cookies" className="font-semibold text-ultraviolet underline underline-offset-4">Política de Cookies</a> e o botão Cookies para gerenciar preferências opcionais. Cookies necessários para login e segurança permanecem ativos.</p>
        </section>
      </div>
    </ContentPage>
  );
}
