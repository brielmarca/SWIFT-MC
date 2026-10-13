import { publicPageMetadata } from "@/lib/seo";
import { NewsListing } from "@/components/news-listing";
import { ContentPage } from "@/components/content/content-page";
import { getPublishedNews } from "@/data/content";

// Visibility depends on publishedAt vs the current date, so render per request.
export const dynamic = "force-dynamic";

export const metadata = publicPageMetadata("/news");

export default function NewsPage() {
  const posts = getPublishedNews();
  return (
    <ContentPage
      active="/news"
      title="Notícias do SWIFT MC"
      description="Atualizações, guias e avisos da comunidade. Busque por um assunto, filtre por categoria ou tag e leia a matéria completa."
    >
      <NewsListing posts={posts} />
    </ContentPage>
  );
}
