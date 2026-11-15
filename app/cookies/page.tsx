import type { Metadata } from "next";
import { ContentPage } from "@/components/content/content-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Política de Cookies",
  description: "Como a SwiftMC utiliza cookies necessários e preferências de privacidade.",
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <ContentPage active="/faq" title="Política de Cookies" description="Informações sobre armazenamento no navegador e suas escolhas.">
      <div className="space-y-4 text-sm leading-7 text-muted">
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Cookies estritamente necessários</h2>
          <p className="mt-3">O site usa cookies para manter sessões autenticadas e proteger formulários contra solicitações não autorizadas (CSRF). Esses cookies dão suporte a funções essenciais e não dependem de autorização para publicidade ou estatísticas.</p>
          <p className="mt-2">O navegador também pode guardar o carrinho em armazenamento local para preservar sua seleção entre acessos.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Estatísticas e publicidade</h2>
          <p className="mt-3">Nesta versão, a SwiftMC não habilita ferramentas analíticas ou publicitárias opcionais. Caso sejam integradas posteriormente, deverão permanecer bloqueadas até uma escolha positiva na categoria correspondente.</p>
          <p className="mt-2">As preferências são armazenadas localmente no seu navegador, podendo ser alteradas ou revogadas pelo botão <strong className="text-ink">Cookies</strong>, disponível em todas as páginas.</p>
        </section>
        <section className="content-panel p-6">
          <h2 className="text-lg font-bold text-ink">Gerenciar preferências</h2>
          <p className="mt-3">Escolha rejeitar todos os cookies opcionais ou personalizar os tipos de consentimento. Você também pode apagar dados do site nas configurações do navegador, mas isso pode encerrar sua sessão ou esvaziar o carrinho.</p>
          <p className="mt-2">Informações gerais sobre dados de conta e pedidos estão no <a href="/privacy" className="font-semibold text-ultraviolet underline underline-offset-4">aviso de privacidade</a>.</p>
        </section>
      </div>
    </ContentPage>
  );
}
