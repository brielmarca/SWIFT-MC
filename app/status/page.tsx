import { publicPageMetadata } from "@/lib/seo";
import { DiscordLink } from "@/components/discord-link";
import { NetworkPage } from "@/components/network-page";
import { ServerStatusPanel } from "@/components/server-status-panel";
import { OnlinePlayers } from "@/components/online-players";

export const metadata = publicPageMetadata("/status");

export default function StatusPage() {
  return <NetworkPage active="/status" title="Status e conexão" description="Consulte a disponibilidade da rede, o IP oficial e os jogadores online quando o servidor responder.">
    <ServerStatusPanel detailed />
    <section className="mt-8 border-t border-white/10 pt-8" aria-labelledby="online-now-title">
      <h2 id="online-now-title" className="text-sm font-bold text-ink">Jogadores online</h2>
      <div className="mt-4"><OnlinePlayers /></div>
    </section>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-muted"><p>Acompanhe avisos e suporte no Discord.</p><DiscordLink className="network-action">Avisos no Discord</DiscordLink></div>
  </NetworkPage>;
}
