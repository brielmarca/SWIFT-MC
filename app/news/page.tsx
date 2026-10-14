import { publicPageMetadata } from "@/lib/seo";
import { NewsListing } from "@/components/news-listing";
import { ContentPage } from "@/components/content/content-page";
import { getPublishedNews } from "@/data/content";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/news");

export default function NewsPage() {
  return <ContentPage active="/news" title="Notícias do SWIFT MC" description="Atualizações, guias e avisos da comunidade. Busque por um assunto, filtre por categoria ou tag e leia a matéria completa.">
    <NewsListing posts={getPublishedNews()} />
  </ContentPage>;
}
