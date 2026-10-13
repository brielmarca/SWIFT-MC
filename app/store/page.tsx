import type { Metadata } from "next";
import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { StoreCatalog } from "@/components/store-catalog";

export const metadata: Metadata = {
  title: "Loja de Ranks | SWIFT MC",
  description: "Compare os ranks Swift, Eclipse, Cosmic e Overdrive da rede SWIFT MC.",
};

const assurances = [
  { icon: Zap, title: "Escolha rápida", text: "Compare os níveis e salve sua seleção no carrinho deste dispositivo." },
  { icon: ShieldCheck, title: "Benefícios permanentes", text: "Todos os ranks apresentados possuem duração vitalícia." },
  { icon: Sparkles, title: "Progressão preservada", text: "Cada nível inclui vantagens que ampliam sua experiência Survival." },
];

export default function StorePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-white/10 py-8 sm:py-12">
          <div className="ambient ambient-left" />
          <div className="site-container relative z-10">
            <header className="border-l-2 border-violet pl-4 sm:pl-5">
              <p className="eyebrow">Loja oficial</p>
              <h1 className="page-title mt-2">
                Escolha seu <span className="gradient-text">rank permanente</span>
              </h1>
              <p className="page-description">
                Compare preços, duração e vantagens para encontrar o nível ideal para sua jornada no SWIFT Survival.
              </p>
            </header>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {assurances.map(({ icon: Icon, title, text }) => (
                <div key={title} className="glass-panel flex items-start gap-4 p-5 text-left">
                  <span className="icon-well !h-10 !w-10 shrink-0"><Icon size={19} aria-hidden="true" /></span>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wide text-ink">{title}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative flex items-center">
          <div className="absolute inset-0 z-0">
            <img
              src="/brand/enderman.png"
              alt=""
              className="w-full h-full object-cover opacity-30"
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
          </div>
          <div className="site-container page-section relative z-10">
            <StoreCatalog />
            <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-muted">
              Seu carrinho fica salvo apenas neste dispositivo. Nenhuma cobrança será realizada nesta fase.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
