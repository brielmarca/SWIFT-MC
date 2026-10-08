"use client";

import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import type { RankSlug } from "@/data/ranks";
import { useCart } from "./cart-provider";

type BuyNowButtonProps = {
  slug: RankSlug;
  disabled?: boolean;
};

export function BuyNowButton({ slug, disabled = false }: BuyNowButtonProps) {
  const { hasItem, addItem, closeCart } = useCart();
  const router = useRouter();

  if (disabled) {
    return (
      <button type="button" disabled className="button-primary cursor-not-allowed opacity-50">
        <ShoppingBag size={18} aria-hidden="true" />
        Indisponível
      </button>
    );
  }

  return (
    <button
      type="button"
      className="button-primary"
      onClick={() => {
        if (!hasItem(slug)) addItem(slug);
        closeCart();
        router.push("/checkout");
      }}
    >
      <ShoppingBag size={18} aria-hidden="true" /> Comprar agora
    </button>
  );
}