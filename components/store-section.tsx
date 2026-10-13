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
          eyebrow="VIPs"
          title="Ranks permanentes"
          description="Quatro níveis progressivos. Cada um inclui tudo do anterior + kits mais fortes."
        />
        <div className="mt-10 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ranks.map((rank) => <RankCard key={rank.slug} rank={rank} variant="preview" />)}
        </div>
        <div className="mt-8 flex justify-center">
          <Link href="/store" className="button-secondary">Explorar loja completa</Link>
        </div>
      </div>
    </section>
  );
}
