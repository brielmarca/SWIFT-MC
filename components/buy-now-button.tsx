"use client";

import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import type { RankSlug } from "@/data/ranks";
import { useCart } from "./cart-provider";

export function BuyNowButton({ slug }: { slug: RankSlug }) {
  const { hasItem, addItem, closeCart } = useCart();
  const router = useRouter();
  return <button type="button" className="button-primary" onClick={() => {
    if (!hasItem(slug)) addItem(slug);
    closeCart();
    router.push("/checkout");
  }}><ShoppingBag size={18} aria-hidden="true" /> Comprar agora</button>;
}
