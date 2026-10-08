import type { Metadata } from "next";
import { NetworkPage } from "@/components/network-page";
import { PlayerSearch } from "@/components/player-search";

export const metadata: Metadata = { title: "Jogadores | SWIFT MC", description: "Busque perfis públicos do Minecraft Java pelo nome do jogador." };

export default function PlayersPage() {
  return <NetworkPage active="/player" title="Encontre um jogador" description="Um nome, uma identidade. Explore perfis Minecraft e a trajetória de cada jogador na SwiftMC."><PlayerSearch /></NetworkPage>;
}
