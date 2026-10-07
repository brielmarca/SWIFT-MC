import type { Metadata } from "next";
import { Leaderboards } from "@/components/leaderboards";
import { PlayerPage } from "@/components/player-page";

export const metadata: Metadata = {
  title: "Ranking | SWIFT MC",
  description: "Confira o ranking de tempo de jogo, abates e coins do servidor SWIFT MC com dados reais da API do servidor.",
};

export default function LeaderboardsPage() {
  return <PlayerPage title="Ranking do servidor" description="Os melhores jogadores por categoria, informados diretamente pela API do servidor SWIFT MC. Quando a integração não está disponível, nada é estimado.">
    <Leaderboards />
  </PlayerPage>;
}
