import type { Metadata } from "next";
import { Diamond, ShieldCheck, Sparkles, Zap } from "lucide-react";
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
        <section className="relative overflow-hidden border-b border-white/[0.06] py-16 sm:py-20">
          <div className="ambient ambient-left" />
          <div className="site-container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="status-chip !text-ultraviolet"><Diamond size={15} aria-hidden="true" /> Loja oficial</div>
              <h1 className="mt-6 text-4xl font-extrabold uppercase leading-[1.05] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[56px]">
                Escolha seu <span className="gradient-text">rank permanente</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
                Compare preços, duração e vantagens para encontrar o nível ideal para sua jornada no SWIFT Survival.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
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

        <section className="section-shell">
          <div className="site-container">
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