import { getRank, type Rank, type RankSlug } from "@/data/ranks";

export const CART_STORAGE_KEY = "swift-mc-cart";

export function parseCart(value: string | null): RankSlug[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed.reduce<RankSlug[]>((items, slug) => {
      if (typeof slug === "string" && getRank(slug) && !items.includes(slug as RankSlug)) {
        items.push(slug as RankSlug);
      }
      return items;
    }, []);
  } catch {
    return [];
  }
}

export function getCartRanks(slugs: readonly RankSlug[]): Rank[] {
  return slugs.flatMap((slug) => {
    const rank = getRank(slug);
    return rank ? [rank] : [];
  });
}

export function getCartSubtotal(items: readonly Pick<Rank, "priceCents">[]): number {
  return items.reduce((subtotal, rank) => subtotal + rank.priceCents, 0);
}
