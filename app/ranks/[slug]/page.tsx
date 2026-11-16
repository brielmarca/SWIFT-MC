import type { Metadata } from "next";
import { createPageMetadata, SITE_DESCRIPTION, siteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { getRank, ranks } from "@/data/ranks";
import { RankPageClient } from "./rank-page-client";

type RankPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return ranks.map((rank) => ({ slug: rank.slug }));
}

export async function generateMetadata({ params }: RankPageProps): Promise<Metadata> {
  const { slug } = await params;
  const rank = getRank(slug);

  if (!rank) return createPageMetadata({ title: "Rank não encontrado", description: SITE_DESCRIPTION, index: false });

  return createPageMetadata({
    title: `Rank ${rank.name}`,
    description: rank.description,
    path: `/ranks/${encodeURIComponent(rank.slug)}`,
  });
}

export default async function RankPage({ params }: RankPageProps) {
  const { slug } = await params;
  const rank = getRank(slug);

  if (!rank) {
    return <div>Rank não encontrado</div>;
  }

  return <>
    <JsonLd data={{
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: siteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Loja", item: siteUrl("/store") },
        { "@type": "ListItem", position: 3, name: `Rank ${rank.name}`, item: siteUrl(`/ranks/${encodeURIComponent(rank.slug)}`) },
      ],
    }} />
    <RankPageClient rank={rank} />
  </>;
}
