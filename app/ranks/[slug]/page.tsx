import type { Metadata } from "next";
import { ArrowLeft, CheckCircle2, Clock3, Diamond, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Footer } from "@/components/footer";
import { RankComparison } from "@/components/rank-comparison";
import { SiteHeader } from "@/components/site-header";
import { getRank, ranks } from "@/data/ranks";

type RankPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ranks.map((rank) => ({ slug: rank.slug }));
}

export async function generateMetadata({ params }: RankPageProps): Promise<Metadata> {
  const { slug } = await params;
  const rank = getRank(slug);

  if (!rank) return {};

  return {
    title: `${rank.name} | Ranks SWIFT MC`,
    description: `${rank.description} Consulte todos os benefícios do rank ${rank.name}.`,
  };
}

export default async function RankPage({ params }: RankPageProps) {
  const { slug } = await params;
  const rank = getRank(slug);

  if (!rank) notFound();

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-white/[0.06] py-12 sm:py-20">
          <div className="ambient ambient-right" />
          <div className="site-container relative z-10">
            <Link href="/store" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">
              <ArrowLeft size={17} aria-hidden="true" /> Voltar para a loja
            </Link>
            <div className="mt-8 grid items-center gap-10 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className={`rank-badge ${rank.featured ? "rank-badge-featured" : ""}`}>
                  {rank.featured ? <Sparkles size={13} aria-hidden="true" /> : <Diamond size={13} aria-hidden="true" />}
                  {rank.featured ? "Mais popular" : rank.badge}
                </div>
                <h1 className="mt-6 text-5xl font-extrabold uppercase tracking-[-0.04em] text-ink sm:text-6xl lg:text-7xl">Rank <span className="gradient-text">{rank.name}</span></h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">{rank.description}</p>
              </div>
              <aside className={`glass-panel p-6 sm:p-8 lg:col-span-5 ${rank.featured ? "border-violet/45 shadow-violet" : ""}`} aria-label={`Resumo do rank ${rank.name}`}>
                <p className="micro-label">Valor do rank</p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <span className="text-4xl font-extrabold tabular-nums text-ink">{rank.price}</span>
                  <span className="micro-label pb-1">Valor total</span>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
                  <Clock3 size={20} className="text-ultraviolet" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Duração</p>
                    <p className="mt-0.5 font-bold text-ink">{rank.duration}</p>
                  </div>
                </div>
                <AddToCartButton slug={rank.slug} className="button-primary mt-6 w-full" />
                <Link href="/store#store-search" className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">Continuar na loja</Link>
                <p className="mt-2 text-center text-xs leading-5 text-muted">Sua seleção fica salva localmente neste dispositivo.</p>
              </aside>
            </div>
          </div>
        </section>

        <section className="section-shell">
          <div className="site-container grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="eyebrow">Pacote completo</p>
              <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Todos os benefícios do {rank.name}</h2>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {rank.benefits.map((benefit) => (
                  <div key={benefit} className="feature-card flex items-start gap-3 !p-5">
                    <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
                    <p className="text-sm leading-6 text-ink/90">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="lg:col-span-4">
              <div className="glass-panel sticky top-24 p-6">
                <p className="micro-label !text-ultraviolet">Visão rápida</p>
                <dl className="mt-5 space-y-4">
                  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4"><dt className="text-sm text-muted">Terrenos extras</dt><dd className="font-bold text-ink">{rank.comparison.protectedLands}</dd></div>
                  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4"><dt className="text-sm text-muted">Mercado</dt><dd className="font-bold text-ink">{rank.comparison.marketMultiplier}</dd></div>
                  <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4"><dt className="text-sm text-muted">mcMMO</dt><dd className="font-bold text-ink">{rank.comparison.mcmmoMultiplier}</dd></div>
                  <div className="flex items-center justify-between gap-4"><dt className="text-sm text-muted">Baús virtuais</dt><dd className="font-bold text-ink">{rank.comparison.virtualChests}</dd></div>
                </dl>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-black/20 py-20 sm:py-24">
          <div className="site-container">
            <div className="max-w-2xl">
              <p className="eyebrow">Compare os níveis</p>
              <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Encontre o rank ideal</h2>
              <p className="mt-4 text-base leading-7 text-muted">Veja como os três níveis se diferenciam nos benefícios principais.</p>
            </div>
            <div className="mt-8"><RankComparison /></div>
          </div>
        </section>

        <section className="section-shell">
          <div className="site-container grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="eyebrow">Perguntas frequentes</p>
              <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Antes de escolher</h2>
              <p className="mt-4 text-sm leading-6 text-muted">Informações importantes sobre duração, plataformas e disponibilidade.</p>
            </div>
            <div className="space-y-3 lg:col-span-8">
              {rank.faq.map((item) => (
                <details key={item.question} className="group rounded-xl border border-white/[0.07] bg-card/75 p-5 open:border-violet/35 open:bg-elevated/70">
                  <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink marker:hidden">
                    {item.question}
                    <span className="text-xl text-ultraviolet transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="mt-4 max-w-3xl border-t border-white/[0.07] pt-4 text-sm leading-6 text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
