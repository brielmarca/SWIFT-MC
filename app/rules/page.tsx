import type { Metadata } from "next";
import { PlayerPage } from "@/components/player-page";
import { SearchableGuide } from "@/components/searchable-guide";
import { rules } from "@/data/player-guides";

export const metadata: Metadata = { title: "Regras do servidor | SWIFT MC", description: "Consulte as regras de convivência, jogo justo e segurança da comunidade SWIFT MC." };

export default function RulesPage() {
  return <PlayerPage title="Regras do servidor" description="Uma comunidade melhor começa com respeito e jogo justo. Encontre um assunto ou compartilhe o link direto de uma regra."><SearchableGuide entries={rules} kind="rules" /></PlayerPage>;
}
