import { Metadata } from "next";
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

  if (!rank) return {};

  return {
    title: `${rank.name} | Ranks SWIFT MC`,
    description: `${rank.description} Consulte todos os benefícios, kits e comparação do rank ${rank.name}.`,
  };
}

export default async function RankPage({ params }: RankPageProps) {
  const { slug } = await params;
  const rank = getRank(slug);

  if (!rank) {
    return <div>Rank não encontrado</div>;
  }

  return <RankPageClient rank={rank} />;
}