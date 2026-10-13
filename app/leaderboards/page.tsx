import { publicPageMetadata } from "@/lib/seo";
import { Leaderboards } from "@/components/leaderboards";
import { NetworkPage } from "@/components/network-page";

export const metadata = publicPageMetadata("/leaderboards");

export default function LeaderboardsPage() {
  return <NetworkPage active="/leaderboards" title="Ranking do servidor" description="Quem faz história na SwiftMC. Explore os destaques em tempo de jogo, abates e coins.">
    <Leaderboards />
  </NetworkPage>;
}
