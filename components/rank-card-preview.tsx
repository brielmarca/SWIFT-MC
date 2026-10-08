"use client";

import { Crown, Diamond, ShieldCheck, Sparkles, Star, ShoppingBag, ImageIcon } from "lucide-react";
import Link from "next/link";
import type { Rank } from "@/data/ranks";
import { useCart } from "./cart-provider";
import { useRouter } from "next/navigation";

type RankCardPreviewProps = {
  rank: Rank;
};

const rankArtworkPaths: Record<string, string> = {
  swift: "/brand/ranks/swift.png",
  eclipse: "/brand/ranks/eclipse.png",
  cosmic: "/brand/ranks/cosmic.png",
  overdrive: "/brand/ranks/overdrive.png",
};

function getRankIcon(rank: Rank) {
  if (rank.featured) return <Sparkles className="text-ultraviolet" aria-hidden="true" />;
  if (rank.slug === "overdrive") return <Crown className="text-ultraviolet" aria-hidden="true" />;
  return <ShieldCheck className="text-muted" aria-hidden="true" />;
}

function getRankGlowClass(rank: Rank) {
  if (rank.slug === "overdrive") return "hover:ring-2 hover:ring-ultraviolet/60 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]";
  if (rank.featured) return "hover:ring-1 hover:ring-ultraviolet/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]";
  return "hover:ring-1 hover:ring-ultraviolet/20 hover:shadow-[0_0_14px_rgba(139,92,246,0.15)]";
}

export function RankCardPreview({ rank }: RankCardPreviewProps) {
  const { hasItem, addItem } = useCart();
  const router = useRouter();
  const isAdded = hasItem(rank.slug);
  const hasPrice = rank.price !== null;
  const artworkSrc = rankArtworkPaths[rank.slug];

  const handleAddToCart = () => {
    if (isAdded) return;
    addItem(rank.slug);
  };

  const handleBuyNow = () => {
    if (!hasItem(rank.slug)) addItem(rank.slug);
    router.push("/checkout");
  };

  return (
    <article
      className={`rank-card-tall ${rank.featured ? "rank-card-featured" : ""} ${getRankGlowClass(rank)}`}
      style={{ willChange: "transform, box-shadow" }}
    >
      {rank.featured && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 popular-ribbon">
          <Star size={11} fill="currentColor" aria-hidden="true" /> Mais popular
        </div>
      )}

      <div className="relative h-[65%] overflow-hidden rounded-t-xl">
        <img
          src={artworkSrc}
          alt={`Arte do rank ${rank.name}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <div className="placeholder-art absolute inset-0 hidden flex items-center justify-center bg-gradient-to-br from-void via-card to-deep">
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
                <span className="micro-label pb-1 text-muted/60">total</span>
              </>
            ) : (
              <span className="text-xl font-extrabold tabular-nums text-muted">Preço em breve</span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted/60">Pagamentos pausados — seleção local</p>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!hasPrice}
            className={`button-primary w-full py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
              !hasPrice
                ? "cursor-not-allowed opacity-50 hover:opacity-50"
                : "hover:shadow-[0_0_18px_rgba(139,92,246,0.35)]"
            }`}
          >
            <ShoppingBag size={16} className="inline-block mr-2" aria-hidden="true" />
            {hasPrice ? "Comprar agora" : "Indisponível"}
          </button>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!hasPrice}
            className={`button-secondary w-full py-2.5 text-sm font-bold uppercase tracking-wider transition-all ${
              !hasPrice
                ? "cursor-not-allowed opacity-50 hover:opacity-50"
                : ""
            }`}
          >
            {isAdded ? "Ver carrinho" : "Adicionar ao carrinho"}
          </button>
          <Link
            href={`/ranks/${rank.slug}`}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
          >
            <Diamond size={15} className="text-ultraviolet" aria-hidden="true" /> Ver benefícios
          </Link>
        </div>
      </div>
    </article>
  );
}