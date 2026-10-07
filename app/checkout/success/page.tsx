import type { Metadata } from "next";
import { Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Footer } from "@/components/footer";
import { DiscordLink } from "@/components/discord-link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Prévia de status do pedido | SWIFT MC",
  description: "Prévia visual e não autoritativa de um pedido pendente SWIFT MC.",
};

export default function CheckoutSuccessPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="relative min-h-[75vh] overflow-hidden py-12 sm:py-20">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <div className="site-container relative z-10">
          <section className="glass-panel mx-auto max-w-3xl overflow-hidden" aria-labelledby="preview-title">
            <div className="border-b border-white/[0.07] bg-gradient-to-b from-violet/[0.12] to-transparent px-5 py-9 text-center sm:px-10 sm:py-12">
              <span className="status-chip !border-violet/25 !bg-violet/10 !text-ultraviolet">Prévia visual isolada</span>
              <span className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full border border-violet/30 bg-violet/10 text-ultraviolet">
                <Clock3 size={30} aria-hidden="true" />
              </span>
              <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-ultraviolet">Exemplo de pedido pendente</p>
              <h1 id="preview-title" className="mt-3 text-3xl font-extrabold uppercase tracking-[-0.03em] text-ink sm:text-4xl">Aguardando pagamento</h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted">Esta rota não participa do fluxo real, não consulta pedidos e não comprova pagamento. Somente um webhook verificado poderá confirmar um pagamento no futuro.</p>
            </div>
            <div className="p-5 sm:p-8">
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
                <p className="text-sm font-bold text-amber-200">Nenhum pedido ou pagamento é representado nesta página.</p>
                <p className="mt-2 text-sm leading-6 text-muted">O fluxo atual exibe o pedido recém-criado diretamente no checkout, sempre com status pendente.</p>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Link href="/store" className="button-primary"><ShieldCheck size={18} aria-hidden="true" /> Voltar para a loja</Link>
                <DiscordLink className="button-secondary"><MessageCircle size={18} className="text-ultraviolet" aria-hidden="true" /> Entrar no Discord</DiscordLink>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
