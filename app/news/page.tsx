import type { Metadata } from "next";
import { NewsListing } from "@/components/news-listing";
import { PlayerPage } from "@/components/player-page";
import { getPublishedNews } from "@/data/content";

// Visibility depends on publishedAt vs the current date, so render per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Novidades | SWIFT MC",
  description: "Notícias, atualizações e avisos da comunidade do servidor SWIFT MC.",
};

export default function NewsPage() {
  const posts = getPublishedNews();
  return (
    <PlayerPage
      eyebrow="Novidades"
      title="Notícias do SWIFT MC"
      description="Atualizações, guias e avisos da comunidade. Busque por um assunto, filtre por categoria ou tag e leia a matéria completa."
    >
      <NewsListing posts={posts} />
    </PlayerPage>
  );
}
