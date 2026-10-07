import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NewsPost } from "@/data/content";
import { formatNewsShortDate } from "@/lib/content-format";

export function ArticleCard({ post, headingId }: { post: NewsPost; headingId?: string }) {
  return (
    <article className="feature-card group flex h-full flex-col overflow-hidden !p-0">
      {post.image && (
        <div className="relative aspect-[16/9] w-full shrink-0 border-b border-white/[0.06] bg-void/60">
          <Image
            src={post.image.src}
            alt={post.image.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover opacity-90 transition group-hover:opacity-100"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rank-badge rank-badge-featured">{post.category}</span>
          <time dateTime={post.publishedAt} className="micro-label">{formatNewsShortDate(post.publishedAt)}</time>
        </div>
        <h3 id={headingId} className="mt-4 text-lg font-bold leading-6 text-ink">
          <Link href={`/news/${post.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">{post.title}</Link>
        </h3>
        <p className="mt-3 flex-1 text-sm leading-6 text-muted">{post.excerpt}</p>
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{tag}</li>
            ))}
          </ul>
        )}
        <span className="mt-5 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ultraviolet">
          Ler notícia <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
