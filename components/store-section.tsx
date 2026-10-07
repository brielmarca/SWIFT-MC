import { Diamond } from "lucide-react";
import Link from "next/link";
import { ranks } from "@/data/ranks";
import { RankCard } from "./rank-card";
import { SectionHeading } from "./section-heading";

export function StoreSection() {
  return (
    <section id="loja" className="section-shell scroll-mt-24">
      <div className="site-container">
        <SectionHeading
          icon={Diamond}
          eyebrow="Store tiers"
          title="Ranks premium do servidor"
          description="Eleve seu status e desbloqueie utilidades permanentes para aproveitar ainda mais cada etapa do Survival."
        />
        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {ranks.map((rank) => <RankCard key={rank.slug} rank={rank} />)}
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/store" className="button-secondary">Explorar loja completa</Link>
        </div>
      </div>
    </section>
  );
}
