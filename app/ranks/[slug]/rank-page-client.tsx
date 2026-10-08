"use client";

import { useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Diamond, Package, Sparkles, Star, Shield, Sword, HeartPulse, Zap } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { Footer } from "@/components/footer";
import { RankComparison } from "@/components/rank-comparison";
import { SiteHeader } from "@/components/site-header";
import { getRank, type Rank } from "@/data/ranks";

type KitDisplayItem = {
  quantity: number;
  name: string;
  enchantments?: readonly string[];
};

type KitDisplay = {
  title: string;
  cooldown: string;
  icon: React.ReactNode;
  items: readonly KitDisplayItem[];
  money?: number;
  claimBlocks?: number;
  mcmmoXp?: number;
};

type RankPageClientProps = {
  rank: Rank;
};

function KitAccordion({ kit, initiallyOpen = false }: { kit: KitDisplay; initiallyOpen?: boolean }) {
  const [open] = useState(initiallyOpen);

  return (
    <details className={`group rounded-xl border border-white/[0.07] bg-card/75 ${open ? "open:border-violet/35 open:bg-elevated/70" : ""}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold text-ink marker:hidden">
        <div className="flex items-center gap-3">
          {kit.icon}
          <span>{kit.title}</span>
          <span className="micro-label px-2 py-0.5 rounded border border-white/[0.1]">{kit.cooldown}</span>
        </div>
        <span className="text-xl text-ultraviolet transition-transform group-open:rotate-45" aria-hidden="true">+</span>
      </summary>
      <div className="px-5 pb-5 pt-2 border-t border-white/[0.07]">
        <ul className="space-y-3">
          {kit.items.map((item, index) => (
            <li key={`${kit.title}-${index}`} className="flex items-start gap-3 text-sm leading-5 text-ink/90">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <span>
                <strong>{item.quantity}x</strong> {item.name}
                {item.enchantments && item.enchantments.length > 0 && (
                  <span className="ml-2 text-xs text-muted"> ({item.enchantments.join(", ")})</span>
                )}
              </span>
            </li>
          ))}
          {kit.money && (
            <li className="flex items-center gap-3 text-sm leading-5 text-ink/90">
              <Zap size={18} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <span>{kit.money.toLocaleString("pt-BR")} moedas do jogo</span>
            </li>
          )}
          {kit.claimBlocks && (
            <li className="flex items-center gap-3 text-sm leading-5 text-ink/90">
              <Shield size={18} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <span>{kit.claimBlocks.toLocaleString("pt-BR")} blocos de claim</span>
            </li>
          )}
          {kit.mcmmoXp && (
            <li className="flex items-center gap-3 text-sm leading-5 text-ink/90">
              <Star size={18} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <span>{kit.mcmmoXp.toLocaleString("pt-BR")} de XP no mcMMO</span>
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}

function InheritanceNotice({ rank }: { rank: Rank }) {
  if (!rank.inheritsFrom) return null;
  const parent = getRank(rank.inheritsFrom);
  if (!parent) return null;

  return (
    <div className="mb-8 rounded-xl border border-violet/30 bg-violet/[0.05] p-5">
      <div className="flex items-center gap-3">
        <Sparkles size={20} className="text-ultraviolet" aria-hidden="true" />
        <div>
          <p className="font-bold text-ink">Inclui todos os benefícios do <span className="gradient-text">{parent.name}</span></p>
          <p className="mt-1 text-sm text-muted">Este rank herda automaticamente todas as vantagens, kits e comandos do rank anterior.</p>
        </div>
      </div>
    </div>
  );
}

function OverviewSection({ rank }: { rank: Rank }) {
  return (
    <section className="section-shell" aria-labelledby="overview-heading">
      <div className="site-container grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p id="overview-heading" className="eyebrow">Visão geral</p>
          <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Rank <span className="gradient-text">{rank.name}</span></h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">{rank.description}</p>
          <InheritanceNotice rank={rank} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {rank.summaryBenefits.map((benefit) => (
              <div key={benefit} className="feature-card flex items-start gap-3 !p-5">
                <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
                <p className="text-sm leading-6 text-ink/90">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
        <aside className="lg:col-span-5">
          <div className="glass-panel sticky top-24 p-6">
            <p className="micro-label !text-ultraviolet">Resumo do rank</p>
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-sm text-muted">Duração</dt>
                <dd className="font-bold text-ink">{rank.duration}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-sm text-muted">Valor</dt>
                <dd className="font-bold text-ink">{rank.price ?? "TBD (a definir)"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-sm text-muted">Homes</dt>
                <dd className="font-bold text-ink">{rank.comparison.homes}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-sm text-muted">XP mcMMO</dt>
                <dd className="font-bold text-ink">{rank.comparison.mcmmoXpBonus}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                <dt className="text-sm text-muted">Blocos de claim/mês</dt>
                <dd className="font-bold text-ink">{rank.comparison.monthlyClaimBlocks.toLocaleString("pt-BR")}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-muted">Dinheiro/mês</dt>
                <dd className="font-bold text-ink">${rank.comparison.monthlyMoney.toLocaleString("pt-BR")}</dd>
              </div>
            </div>
            <AddToCartButton slug={rank.slug} className="button-primary mt-6 w-full" disabled={!rank.price} />
            <Link href="/store#store-search" className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">Continuar na loja</Link>
            <p className="mt-2 text-center text-xs leading-5 text-muted">Sua seleção fica salva localmente neste dispositivo.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function VantagensSection({ rank }: { rank: Rank }) {
  return (
    <section className="border-y border-white/[0.06] bg-black/20 py-20 sm:py-24" aria-labelledby="vantagens-heading">
      <div className="site-container">
        <div className="max-w-3xl">
          <p id="vantagens-heading" className="eyebrow">Vantagens</p>
          <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Todas as vantagens do {rank.name}</h2>
        </div>
        <InheritanceNotice rank={rank} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rank.benefits.map((benefit) => (
            <div key={benefit} className="feature-card flex items-start gap-3 !p-5">
              <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <p className="text-sm leading-6 text-ink/90">{benefit}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KitsSection({ rank }: { rank: Rank }) {
  const kits: KitDisplay[] = [
    {
      title: "Kit Diário",
      cooldown: "24 horas",
      icon: <Sword size={20} className="text-ultraviolet" aria-hidden="true" />,
      items: rank.dailyKit.items,
      money: rank.dailyKit.money,
      claimBlocks: rank.dailyKit.claimBlocks,
      mcmmoXp: rank.dailyKit.mcmmoXp,
    },
    {
      title: "Kit Semanal",
      cooldown: "7 dias",
      icon: <Package size={20} className="text-ultraviolet" aria-hidden="true" />,
      items: rank.weeklyKit.items,
      money: rank.weeklyKit.money,
      claimBlocks: rank.weeklyKit.claimBlocks,
      mcmmoXp: rank.weeklyKit.mcmmoXp,
    },
    {
      title: "Kit Mensal",
      cooldown: "30 dias",
      icon: <Star size={20} className="text-ultraviolet" aria-hidden="true" />,
      items: rank.monthlyKit.items,
      money: rank.monthlyKit.money,
      claimBlocks: rank.monthlyKit.claimBlocks,
      mcmmoXp: rank.monthlyKit.mcmmoXp,
    },
    {
      title: "Kit de Boas-vindas",
      cooldown: "Resgate único",
      icon: <HeartPulse size={20} className="text-ultraviolet" aria-hidden="true" />,
      items: rank.welcomeKit.items,
      money: rank.welcomeKit.money,
      claimBlocks: rank.welcomeKit.claimBlocks,
      mcmmoXp: rank.welcomeKit.mcmmoXp,
    },
  ];

  return (
    <section className="section-shell" aria-labelledby="kits-heading">
      <div className="site-container">
        <p id="kits-heading" className="eyebrow">Kits</p>
        <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Kits do {rank.name}</h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">Clique em cada kit para ver os itens completos, encantamentos e recompensas.</p>
        <InheritanceNotice rank={rank} />
        <div className="mt-8 space-y-4">
          {kits.map((kit) => (
            <KitAccordion key={kit.title} kit={kit} initiallyOpen={kit.title === "Kit Diário"} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ComoFuncionaSection() {
  return (
    <section className="border-y border-white/[0.06] bg-black/20 py-20 sm:py-24" aria-labelledby="como-funciona-heading">
      <div className="site-container">
        <div className="mx-auto max-w-3xl text-center">
          <p id="como-funciona-heading" className="eyebrow">Como funciona</p>
          <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Ativação e resgate dos kits</h2>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="glass-panel flex flex-col items-center text-center p-6">
            <div className="icon-well !h-14 !w-14"><Diamond size={24} className="text-ultraviolet" aria-hidden="true" /></div>
            <h3 className="mt-4 text-lg font-bold text-ink">Abra o menu</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Digite <kbd className="px-2 py-0.5 rounded bg-white/[0.05] font-mono">/vip</kbd> ou use o item <strong>MENU VIP</strong> na sua barra.</p>
          </div>
          <div className="glass-panel flex flex-col items-center text-center p-6">
            <div className="icon-well !h-14 !w-14"><Zap size={24} className="text-ultraviolet" aria-hidden="true" /></div>
            <h3 className="mt-4 text-lg font-bold text-ink">Clique para resgatar</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Cada kit tem seu próprio botão. O cooldown é individual por kit.</p>
          </div>
          <div className="glass-panel flex flex-col items-center text-center p-6">
            <div className="icon-well !h-14 !w-14"><HeartPulse size={24} className="text-ultraviolet" aria-hidden="true" /></div>
            <h3 className="mt-4 text-lg font-bold text-ink">Automático</h3>
            <p className="mt-2 text-sm leading-6 text-muted">Kits e vantagens ativam automaticamente após a compra. Sem burocracia.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RankPageClient({ rank }: RankPageClientProps) {
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
                  {rank.price ? (
                    <span className="text-4xl font-extrabold tabular-nums text-ink">{rank.price}</span>
                  ) : (
                    <span className="text-4xl font-extrabold tabular-nums text-muted">TBD</span>
                  )}
                  <span className="micro-label pb-1">Valor total</span>
                </div>
                <div className="mt-5 flex items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.03] p-4">
                  <Clock3 size={20} className="text-ultraviolet" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Duração</p>
                    <p className="mt-0.5 font-bold text-ink">{rank.duration}</p>
                  </div>
                </div>
                <AddToCartButton slug={rank.slug} className="button-primary mt-6 w-full" disabled={!rank.price} />
                <Link href="/store#store-search" className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">Continuar na loja</Link>
                <p className="mt-2 text-center text-xs leading-5 text-muted">Sua seleção fica salva localmente neste dispositivo.</p>
              </aside>
            </div>
          </div>
        </section>

        <OverviewSection rank={rank} />
        <VantagensSection rank={rank} />
        <KitsSection rank={rank} />

        <section className="border-y border-white/[0.06] bg-black/20 py-20 sm:py-24" aria-labelledby="comparison-heading">
          <div className="site-container">
            <div className="max-w-2xl">
              <p id="comparison-heading" className="eyebrow">Compare os níveis</p>
              <h2 className="mt-3 text-[26px] font-bold uppercase leading-[34px] tracking-[-0.015em] text-ink sm:text-[32px] sm:leading-10">Encontre o rank ideal</h2>
              <p className="mt-4 text-base leading-7 text-muted">Veja como os quatro níveis se diferenciam nos benefícios principais.</p>
            </div>
            <div className="mt-8"><RankComparison /></div>
          </div>
        </section>

        <ComoFuncionaSection />

        <section className="section-shell" aria-labelledby="faq-heading">
          <div className="site-container grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p id="faq-heading" className="eyebrow">Perguntas frequentes</p>
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