import { publicPageMetadata } from "@/lib/seo";
import { ContentPage } from "@/components/content/content-page";
import { WikiListing } from "@/components/wiki/wiki-listing";
import { getPublishedGuides } from "@/data/wiki";

export const metadata = publicPageMetadata("/wiki");

export default function WikiPage() {
  const guides = getPublishedGuides();
  return (
    <ContentPage
      active="/wiki"
      title="Guias do servidor"
      description="Guias completos do SWIFT MC: busque por um assunto, filtre por categoria e abra o passo a passo detalhado."
    >
      <WikiListing guides={guides} />
    </ContentPage>
  );
}
