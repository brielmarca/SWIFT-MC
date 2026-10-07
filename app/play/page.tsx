import type { Metadata } from "next";
import Link from "next/link";
import { DiscordLink } from "@/components/discord-link";
import { PlayerPage } from "@/components/player-page";
import { ServerStatusPanel } from "@/components/server-status-panel";
import { serverInfo } from "@/data/server-info";

export const metadata: Metadata = { title: "Como jogar | SWIFT MC", description: "Endereço, status e instruções para entrar no servidor Minecraft Java SWIFT MC." };

export default function PlayPage() {
  return <PlayerPage title="Jogue no SWIFT MC" description={`Tudo para começar sua jornada no ${serverInfo.edition}: copie o endereço, confira o status e siga os passos abaixo.`}>
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <div className="min-w-0"><ServerStatusPanel /><div className="mt-5 flex flex-wrap gap-3"><Link href="/status" className="button-secondary">Ver status completo</Link><DiscordLink className="button-secondary">Entrar no Discord</DiscordLink></div></div>
      <section aria-labelledby="connection-title">
        <h2 id="connection-title" className="text-2xl font-bold uppercase text-ink">Como entrar</h2>
        <ol className="mt-6 space-y-4">{serverInfo.connectionSteps.map((step, index) => <li key={step.title} className="glass-panel flex gap-4 p-5"><span className="icon-well shrink-0 font-bold" aria-hidden="true">{index + 1}</span><div><h3 className="font-bold text-ink">{step.title}</h3><p className="mt-2 text-sm leading-6 text-muted">{step.description}</p></div></li>)}</ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/rules" className="button-secondary">Ler as regras</Link>
          <Link href="/wiki/como-entrar-no-servidor" className="button-secondary">Guia completo de entrada</Link>
        </div>
      </section>
    </div>
  </PlayerPage>;
}
