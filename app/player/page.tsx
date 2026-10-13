import { publicPageMetadata } from "@/lib/seo";
import { NetworkPage } from "@/components/network-page";
import { PlayerSearch } from "@/components/player-search";

export const metadata = publicPageMetadata("/player");

export default function PlayersPage() {
  return <NetworkPage active="/player" title="Encontre um jogador" description="Um nome, uma identidade. Explore perfis Minecraft e a trajetória de cada jogador na SwiftMC."><PlayerSearch /></NetworkPage>;
}
