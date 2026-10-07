import { CheckCircle2, Crown, Diamond, ShieldCheck, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import type { Rank } from "@/data/ranks";
import { AddToCartButton } from "./add-to-cart-button";
import { BuyNowButton } from "./buy-now-button";

type RankCardProps = {
  rank: Rank;
  detailed?: boolean;
};

export function RankCard({ rank, detailed = false }: RankCardProps) {
  const benefits = detailed ? rank.benefits : rank.summaryBenefits;

  return (
    <article className={`rank-card ${rank.featured ? "rank-card-featured" : ""}`}>
      {rank.featured && (
        <div className="popular-ribbon">
          <Star size={13} fill="currentColor" aria-hidden="true" /> Mais popular
        </div>
      )}
      <div>
        <div className="flex items-center justify-between gap-4">
          <span className={`rank-badge ${rank.featured ? "rank-badge-featured" : ""}`}>{rank.badge}</span>
          {rank.name === "MVP" ? (
            <Crown className="text-ultraviolet" aria-hidden="true" />
          ) : rank.featured ? (
            <Sparkles className="text-ultraviolet" aria-hidden="true" />
          ) : (
            <ShieldCheck className="text-muted" aria-hidden="true" />
          )}
        </div>
        <h3 className="mt-6 text-3xl font-extrabold uppercase text-ink">{rank.name}</h3>
        <p className="mt-2 min-h-14 text-sm leading-6 text-muted">{rank.description}</p>
        <div className="mt-6 flex flex-wrap items-end gap-2">
          <span className="text-3xl font-extrabold tabular-nums text-ink">{rank.price}</span>
          <span className="micro-label pb-1">/ {rank.duration}</span>
        </div>
        <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <p className={`micro-label mb-4 ${rank.featured ? "!text-ultraviolet" : ""}`}>Vantagens inclusas</p>
        <ul className="space-y-3">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex gap-3 text-sm leading-5 text-ink/90">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 grid gap-2">
        <BuyNowButton slug={rank.slug} />
        <AddToCartButton slug={rank.slug} className="button-secondary" />
        <Link href={`/ranks/${rank.slug}`} className="inline-flex min-h-11 items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
          <Diamond size={17} className="text-ultraviolet" aria-hidden="true" /> Ver detalhes
        </Link>
      </div>
    </article>
  );
}
