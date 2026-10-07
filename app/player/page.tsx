import type { Metadata } from "next";
import { PlayerPage } from "@/components/player-page";
import { PlayerSearch } from "@/components/player-search";

export const metadata: Metadata = { title: "Jogadores | SWIFT MC", description: "Busque perfis públicos do Minecraft Java pelo nome do jogador." };

export default function PlayersPage() {
  return <PlayerPage title="Jogadores" description="Encontre o perfil público, UUID e visual de um jogador do Minecraft Java."><PlayerSearch /></PlayerPage>;
}
