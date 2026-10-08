import type { Metadata } from "next";
import { DiscordLink } from "@/components/discord-link";
import { NetworkPage } from "@/components/network-page";
import { ServerStatusPanel } from "@/components/server-status-panel";

export const metadata: Metadata = { title: "Status do servidor | SWIFT MC", description: "Consulte o status, jogadores e versão atual do servidor Minecraft SWIFT MC." };

export default function StatusPage() {
  return <NetworkPage active="/status" title="Status do servidor" description="Tudo pronto para jogar? Confira a disponibilidade e os detalhes de conexão.">
    <ServerStatusPanel detailed />
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-sm text-muted"><p>Acompanhe também os avisos da comunidade.</p><DiscordLink className="network-action">Avisos no Discord</DiscordLink></div>
  </NetworkPage>;
}
