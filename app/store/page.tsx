import { publicPageMetadata } from "@/lib/seo";
import { ShieldCheck, Sparkles, Zap, Store } from "lucide-react";
import Link from "next/link";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { StoreCatalog } from "@/components/store-catalog";

export const metadata = publicPageMetadata("/store");

const storeSections = [
  { href: "/store", label: "VIPs", icon: Store },
] as const;

const assurances = [
  { icon: Zap, title: "Escolha rápida", text: "Compare os níveis e salve sua seleção no carrinho deste dispositivo." },
  { icon: ShieldCheck, title: "Assinatura mensal", text: "Cobrança a cada mês, com benefícios disponíveis enquanto a assinatura estiver ativa." },
  { icon: Sparkles, title: "Progressão preservada", text: "Cada nível inclui vantagens que ampliam sua experiência Survival." },
];

export default function StorePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <div>
          <nav aria-label="Loja" className="mb-6 flex flex-wrap gap-1 border-b border-white/10 sm:gap-4">
            {storeSections.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current="page" className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-b-2 px-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:flex-none sm:px-4 sm:text-sm border-ultraviolet text-ultraviolet">
              <Icon size={16} aria-hidden="true" className="hidden shrink-0 sm:block" />{label}
            </Link>)}
          </nav>
          <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
            <p className="eyebrow">Loja</p>
            <h1 className="page-title mt-2">
              Escolha seu <span className="gradient-text">VIP mensal</span>
            </h1>
            <p className="page-description">
              Compare os valores mensais e as vantagens para encontrar o nível ideal para sua jornada no SWIFT Survival.
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

          <section className="relative flex items-center mt-16">
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
        </div>
      </main>
      <Footer />
    </>
  );
}
