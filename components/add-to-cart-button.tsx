"use client";

import { Check, ShoppingBag } from "lucide-react";
import type { RankSlug } from "@/data/ranks";
import { useCart } from "./cart-provider";

type AddToCartButtonProps = {
  slug: RankSlug;
  className?: string;
  disabled?: boolean;
};

export function AddToCartButton({ slug, className = "button-primary", disabled = false }: AddToCartButtonProps) {
  const { addItem, hasItem, openCart } = useCart();
  const isAdded = hasItem(slug);

  if (disabled) {
    return (
      <button type="button" disabled className={`${className} cursor-not-allowed opacity-50`}>
        <ShoppingBag size={18} aria-hidden="true" />
        Indisponível
      </button>
    );
  }

  return (
    <button type="button" onClick={() => isAdded ? openCart() : addItem(slug)} className={className}>
      {isAdded ? <Check size={18} aria-hidden="true" /> : <ShoppingBag size={18} aria-hidden="true" />}
      {isAdded ? "Ver carrinho" : "Adicionar ao carrinho"}
    </button>
  );
}