import type { Metadata } from "next";
import { DiscordLink } from "@/components/discord-link";
import { PlayerPage } from "@/components/player-page";
import { ServerStatusPanel } from "@/components/server-status-panel";

export const metadata: Metadata = { title: "Status do servidor | SWIFT MC", description: "Consulte o status, jogadores e versão atual do servidor Minecraft SWIFT MC." };

export default function StatusPage() {
  return <PlayerPage title="Status do servidor" description="Acompanhe a disponibilidade do servidor e atualize a consulta quando precisar.">
    <div className="max-w-3xl"><ServerStatusPanel detailed /><DiscordLink className="button-secondary mt-6">Avisos no Discord</DiscordLink></div>
  </PlayerPage>;
}
