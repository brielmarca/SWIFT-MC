import { publicPageMetadata } from "@/lib/seo";
import { NewsListing } from "@/components/news-listing";
import { ContentPage } from "@/components/content/content-page";
import { listPublicNews } from "@/lib/editorial/posts";

export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("/news");

export default async function NewsPage() {
  const posts = await listPublicNews();
  return <ContentPage active="/news" title="Notícias da Swift MC" description="Atualizações, guias e avisos da comunidade. Busque por um assunto, filtre por categoria ou tag e leia a matéria completa.">
    <NewsListing posts={posts} />
  </ContentPage>;
}
