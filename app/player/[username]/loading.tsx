import { PlayerPage } from "@/components/player-page";

export default function LoadingPlayer() {
  return <PlayerPage title="Perfil do jogador" description="Consultando o perfil público do Minecraft Java…"><div className="glass-panel min-h-96 p-8 text-muted" role="status">Carregando perfil…</div></PlayerPage>;
}
