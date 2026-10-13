import { notFound, redirect } from "next/navigation";
import { getRank, ranks } from "@/data/ranks";

export const dynamicParams = false;
export function generateStaticParams() { return ranks.map((rank) => ({ slug: rank.slug })); }

// Legacy rank checkout URLs return to rank selection while payment is paused.
export default async function LegacyCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getRank(slug)) notFound();
  redirect(`/ranks/${slug}`);
}
