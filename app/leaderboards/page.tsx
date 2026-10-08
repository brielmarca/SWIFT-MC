import type { Metadata } from "next";
import { Leaderboards } from "@/components/leaderboards";
import { NetworkPage } from "@/components/network-page";

export const metadata: Metadata = {
  title: "Ranking | SWIFT MC",
  description: "Confira o ranking de tempo de jogo, abates e coins do servidor SWIFT MC com dados reais da API do servidor.",
};

export default function LeaderboardsPage() {
  return <NetworkPage active="/leaderboards" title="Ranking do servidor" description="Quem faz história na SwiftMC. Explore os destaques em tempo de jogo, abates e coins.">
    <Leaderboards />
  </NetworkPage>;
}
