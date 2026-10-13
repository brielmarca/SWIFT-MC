import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { WikiGuide } from "@/data/wiki";

export function GuideCard({ guide, headingId }: { guide: WikiGuide; headingId?: string }) {
  return (
    <article className="content-card group flex h-full flex-col p-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="content-chip">{guide.category}</span>
        {guide.featured && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-ultraviolet"><Star size={11} aria-hidden="true" className="fill-current" /> Destaque</span>
        )}
      </div>
      <h3 id={headingId} className="mt-4 text-lg font-bold leading-6 text-ink">
        <Link href={`/wiki/${guide.slug}`} className="after:absolute after:inset-0 after:rounded-xl hover:text-ultraviolet focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ultraviolet">{guide.title}</Link>
      </h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-muted">{guide.description}</p>
      {guide.tags && guide.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
          {guide.tags.map((tag) => (
            <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{tag}</li>
          ))}
        </ul>
      )}
      <span className="mt-4 inline-flex items-center gap-2 border-t border-white/10 pt-3 text-xs font-bold text-ultraviolet">
        Abrir guia <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-1" />
      </span>
    </article>
  );
}
