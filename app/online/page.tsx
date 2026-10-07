import type { Metadata } from "next";
import { OnlinePlayers } from "@/components/online-players";
import { PlayerPage } from "@/components/player-page";

export const metadata: Metadata = {
  title: "Online | SWIFT MC",
  description: "Veja quem está jogando agora no servidor SWIFT MC com a lista de jogadores online informada pela API do servidor.",
};

export default function OnlinePage() {
  return <PlayerPage title="Jogadores online" description="Confira quem está conectado agora, busque por username e acesse o perfil público de cada jogador. A lista mostra somente dados reais informados pelo servidor.">
    <OnlinePlayers />
  </PlayerPage>;
}
