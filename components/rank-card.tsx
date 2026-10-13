"use client";

import { Crown, Diamond, ShieldCheck, Sparkles, Star, ShoppingBag, ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Rank } from "@/data/ranks";
import { useCart } from "./cart-provider";
import { useRouter } from "next/navigation";

type RankCardProps = {
  rank: Rank;
  variant?: "full" | "preview";
};

const rankArtworkPaths: Record<string, string> = {
  swift: "/brand/ranks/swift.png",
  eclipse: "/brand/ranks/eclipse.png",
  cosmic: "/brand/ranks/cosmic.png",
  overdrive: "/brand/ranks/overdrive.jpeg",
};

function getRankIcon(rank: Rank) {
  if (rank.featured) return <Sparkles className="text-ultraviolet" aria-hidden="true" />;
  if (rank.slug === "overdrive") return <Crown className="text-ultraviolet" aria-hidden="true" />;
  return <ShieldCheck className="text-muted" aria-hidden="true" />;
}

export function RankCard({ rank, variant = "full" }: RankCardProps) {
  const { hasItem, addItem, openCart } = useCart();
  const router = useRouter();
  const isAdded = hasItem(rank.slug);
  const hasPrice = rank.price !== null;
  const artworkSrc = rankArtworkPaths[rank.slug];

  const handleAddToCart = () => {
    if (variant === "preview") {
      if (isAdded) return;
      addItem(rank.slug);
    } else {
      if (isAdded) openCart();
      else addItem(rank.slug);
    }
  };

  const handleBuyNow = () => {
    if (!hasItem(rank.slug)) addItem(rank.slug);
    router.push("/checkout");
  };

  return (
    <article
      className={`rank-card-tall ${rank.featured ? "rank-card-featured" : ""}`}
    >
      {rank.featured && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 popular-ribbon">
          <Star size={11} fill="currentColor" aria-hidden="true" /> Mais popular
        </div>
      )}

      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-xl">
        <Image
          src={artworkSrc}
          alt={`Arte do rank ${rank.name}`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        />
        <div className="absolute inset-0 hidden flex items-center justify-center bg-gradient-to-br from-void via-card to-deep">
          <ImageIcon size={48} className="text-muted/30" aria-hidden="true" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className={`rank-badge ${rank.featured ? "rank-badge-featured" : ""}`}>{rank.badge}</span>
          {getRankIcon(rank)}
        </div>
      </div>

      <div className="flex-1 flex flex-col p-5 pb-6">
        <div className="flex-1 flex flex-col justify-end min-h-0">
          <h3 className="text-xl font-extrabold uppercase text-ink tracking-tight">{rank.name}</h3>
          <div className="mt-3 flex items-end gap-2">
            {hasPrice ? (
              <>
                <span className="text-xl font-extrabold tabular-nums text-ink">{rank.price}</span>
                <span className="micro-label pb-1">total</span>
              </>
            ) : (
              <span className="text-xl font-extrabold tabular-nums text-muted">Preço em breve</span>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted">Pagamentos pausados — seleção local</p>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!hasPrice}
            className="button-primary w-full px-4"
          >
            <ShoppingBag size={16} aria-hidden="true" />
            {hasPrice ? "Comprar agora" : "Indisponível"}
          </button>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!hasPrice}
            className="button-secondary w-full px-4"
          >
            {isAdded ? (variant === "preview" ? "Adicionado" : "Ver carrinho") : "Adicionar ao carrinho"}
          </button>
          <Link
            href={`/ranks/${rank.slug}`}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold uppercase tracking-wider text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
          >
            <Diamond size={15} className="text-ultraviolet" aria-hidden="true" /> Ver benefícios
          </Link>
        </div>
      </div>
    </article>
  );
}
