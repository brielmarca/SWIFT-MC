import type { Metadata } from "next";
import Link from "next/link";
import { HelpCircle, MessageCircle, Shield, Server, Wrench } from "lucide-react";
import { CopyIpButton } from "@/components/copy-ip-button";
import { DiscordLink } from "@/components/discord-link";
import { Footer } from "@/components/footer";
import { ServerStatusChip, ServerAddress, ServerStatusProvider } from "@/components/server-status-provider";
import { ServerInfoVersion } from "@/components/server-info-version";
import { ServerInfoStatus } from "@/components/server-info-status";
import { SiteHeader } from "@/components/site-header";
import { serverInfo } from "@/data/server-info";
import { getGuideBySlug } from "@/data/wiki";

const firstStepsGuides = [
  { slug: "comandos-essenciais", title: "Comandos essenciais", description: "Teleporte, casa, chat e economia em um só lugar" },
  { slug: "guia-do-survival", title: "Guia do Survival", description: "Primeiros dias, base protegida e convívio com a comunidade" },
  { slug: "como-funciona-a-economia", title: "Como funciona a economia", description: "Moedas, negociações e leilões sem cair em golpes" },
] as const;

export const metadata: Metadata = {
  title: "Como jogar | SWIFT MC",
  description: "Endereço, status e instruções para entrar no servidor Minecraft Java SWIFT MC.",
};

function ServerInfoWithCopy() {
  return (
    <ServerStatusProvider publicAddress={serverInfo.defaultHost}>
      <section className="glass-panel p-6 sm:p-8" aria-label="Endereço e status do servidor">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="icon-well shrink-0"><Server size={24} aria-hidden="true" /></span>
            <div className="min-w-0">
              <span className="micro-label">Direct connect host · {serverInfo.edition}</span>
              <p className="truncate font-mono text-xl font-bold tracking-wide text-ink"><ServerAddress /></p>
              <p className="mt-0.5 text-xs text-muted">Copie o endereço e adicione à lista de servidores Java.</p>
            </div>
          </div>
          <CopyIpButton />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ServerStatusChip />
          <Link href="/status" className="button-secondary">Ver status completo</Link>
        </div>
      </section>
    </ServerStatusProvider>
  );
}

function HowToJoin() {
  const steps = [
    { title: "Abra o Minecraft Java", description: "No launcher, selecione Multijogador no menu principal." },
    { title: "Adicione o servidor", description: "Clique em Adicionar servidor e escolha um nome de fácil identificação." },
    { title: "Cole o endereço", description: "No campo Endereço do servidor, cole o IP do SWIFT MC." },
    { title: "Entre no servidor", description: "Salve, selecione o servidor na lista e clique em Entrar no servidor." },
  ];

  return (
    <section aria-labelledby="howto-title" className="section-shell">
      <div className="site-container">
        <h2 id="howto-title" className="text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">Como entrar no SwiftMC</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Quatro passos rápidos do launcher ao Survival.</p>
        <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <li key={step.title} className="glass-panel flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <span className="icon-well shrink-0 font-extrabold text-2xl text-ultraviolet" aria-hidden="true">{index + 1}</span>
                <h3 className="font-bold text-ink">{step.title}</h3>
              </div>
              <p className="text-sm leading-6 text-muted">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ServerInfo() {
  return (
    <section className="border-y border-white/[0.06] bg-black/25 py-16 sm:py-20" aria-labelledby="serverinfo-title">
      <div className="site-container">
        <h2 id="serverinfo-title" className="text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">Informações do servidor</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Detalhes técnicos para conexão e compatibilidade.</p>

        <dl className="mt-10 grid gap-6 md:grid-cols-3">
          <div className="min-w-0">
            <dt className="micro-label">Endereço público</dt>
            <ServerInfoAddress />
          </div>
          <div className="min-w-0">
            <dt className="micro-label">Versão suportada</dt>
            <ServerInfoVersion />
          </div>
          <div className="min-w-0">
            <dt className="micro-label">Status atual</dt>
            <ServerInfoStatus />
          </div>
        </dl>
      </div>
    </section>
  );
}

function ServerInfoAddress() {
  return (
    <ServerStatusProvider publicAddress={serverInfo.defaultHost}>
      <dd className="mt-2 break-all font-mono text-xl font-bold text-ink">
        <ServerAddress />
      </dd>
    </ServerStatusProvider>
  );
}

function FirstSteps() {
  const guides = firstStepsGuides.map((g) => getGuideBySlug(g.slug)).filter((g): g is NonNullable<typeof g> => Boolean(g));

  return (
    <section aria-labelledby="firststeps-title" className="section-shell">
      <div className="site-container">
        <h2 id="firststeps-title" className="text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl">Primeiros passos após entrar</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">Guias essenciais para começar bem no Survival.</p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {guides.map((guide) => (
            <Link key={guide.slug} href={`/wiki/${guide.slug}`} className="feature-card">
              <span className="icon-well"><Wrench size={23} aria-hidden="true" /></span>
              <h3 className="mt-5 text-lg font-bold uppercase tracking-tight text-ink">{guide.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{firstStepsGuides.find(g => g.slug === guide.slug)?.description}</p>
            </Link>
          ))}
          <Link href="/rules" className="feature-card">
            <span className="icon-well"><Shield size={23} aria-hidden="true" /></span>
            <h3 className="mt-5 text-lg font-bold uppercase tracking-tight text-ink">Regras do servidor</h3>
            <p className="mt-3 text-sm leading-6 text-muted">Convivência, jogo justo, terrenos e segurança</p>
          </Link>
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/wiki" className="button-secondary">Ver todos os guias</Link>
        </div>
      </div>
    </section>
  );
}

function NeedHelp() {
  return (
    <section id="ajuda" className="section-shell border-t border-white/[0.04]" aria-labelledby="help-title">
      <div className="site-container">
        <div className="community-card">
          <div className="relative z-10 max-w-2xl">
            <div className="status-chip"><span className="status-dot" /> Precisa de ajuda?</div>
            <h2 id="help-title" className="mt-6 text-3xl font-extrabold uppercase tracking-[-0.04em] text-ink sm:text-4xl lg:text-5xl">
              Fale com a <span className="gradient-text">comunidade</span>
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              Suporte direto, dúvidas sobre regras, denúncias ou sugestões.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DiscordLink className="button-primary"><MessageCircle size={19} aria-hidden="true" /> Entrar no Discord</DiscordLink>
              <Link href="/faq" className="button-secondary"><HelpCircle size={18} aria-hidden="true" /> Ver FAQ</Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PlayPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="relative overflow-hidden py-16 sm:py-24">
          <div className="ambient ambient-left" />
          <div className="ambient ambient-right" />
          <div className="site-container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <div className="status-chip !text-ultraviolet"><Server size={15} aria-hidden="true" /> Jogar no SwiftMC</div>
              <h1 className="mt-6 text-4xl font-extrabold uppercase leading-[1.05] tracking-[-0.04em] text-ink sm:text-5xl lg:text-[56px]">
                Entre no <span className="gradient-text">SwiftMC</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted">
                Endereço copiado em um clique. Status ao vivo. Passo a passo para entrar em segundos.
              </p>
              <ServerInfoWithCopy />
            </div>
          </div>
        </section>

        <HowToJoin />
        <ServerInfo />
        <FirstSteps />
        <NeedHelp />
      </main>
      <Footer />
    </>
  );
}