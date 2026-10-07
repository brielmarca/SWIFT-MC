import type { Metadata } from "next";
import { PlayerPage } from "@/components/player-page";
import { WikiListing } from "@/components/wiki/wiki-listing";
import { getPublishedGuides } from "@/data/wiki";

export const metadata: Metadata = {
  title: "Wiki e guias | SWIFT MC",
  description: "Guias do servidor SWIFT MC: primeiros passos, survival, economia, comandos, ranks, eventos e segurança.",
};

export default function WikiPage() {
  const guides = getPublishedGuides();
  return (
    <PlayerPage
      eyebrow="Wiki"
      title="Guias do servidor"
      description="Guias completos do SWIFT MC: busque por um assunto, filtre por categoria e abra o passo a passo detalhado."
    >
      <WikiListing guides={guides} />
    </PlayerPage>
  );
}
