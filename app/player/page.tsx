import { publicPageMetadata } from "@/lib/seo";
import { ContentPage } from "@/components/content/content-page";
import { PlayerSearch } from "@/components/player-search";

export const metadata = publicPageMetadata("/player");

export default function PlayersPage() {
  return <ContentPage active="/player" title="Encontre um jogador" description="Um nome, uma identidade. Explore perfis Minecraft e a trajetória de cada jogador na SwiftMC."><PlayerSearch /></ContentPage>;
}
