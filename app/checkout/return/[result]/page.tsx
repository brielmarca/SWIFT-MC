import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Pagamentos pausados | SWIFT MC" };

export default function CheckoutReturnPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="site-container min-h-[75vh] py-20">
        <section className="glass-panel mx-auto max-w-3xl p-8 text-center sm:p-12">
          <p className="eyebrow">Loja SWIFT MC</p>
          <h1 className="mt-4 text-3xl font-extrabold uppercase text-ink">Pagamentos pausados</h1>
          <p className="mt-4 text-sm leading-6 text-muted">Você pode explorar os ranks e salvar sua seleção no carrinho. Esta página não consulta nem confirma pagamentos ou ativação de ranks.</p>
          <Link href="/store" className="button-primary mt-8">Voltar para a loja</Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
