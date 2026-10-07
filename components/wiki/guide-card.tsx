import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { WikiGuide } from "@/data/wiki";

export function GuideCard({ guide, headingId }: { guide: WikiGuide; headingId?: string }) {
  return (
    <article className="feature-card group flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rank-badge rank-badge-featured">{guide.category}</span>
        {guide.featured && (
          <span className="status-chip !text-ultraviolet"><Star size={11} aria-hidden="true" className="fill-current" /> Destaque</span>
        )}
      </div>
      <h3 id={headingId} className="mt-4 text-lg font-bold leading-6 text-ink">
        <Link href={`/wiki/${guide.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">{guide.title}</Link>
      </h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-muted">{guide.description}</p>
      {guide.tags && guide.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
          {guide.tags.map((tag) => (
            <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{tag}</li>
          ))}
        </ul>
      )}
      <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ultraviolet">
        Abrir guia <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-1" />
      </span>
    </article>
  );
}
