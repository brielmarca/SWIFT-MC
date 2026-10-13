import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { NewsPost } from "@/data/content";
import { formatNewsShortDate } from "@/lib/content-format";

export function ArticleCard({ post, headingId }: { post: NewsPost; headingId?: string }) {
  return (
    <article className="content-card group flex h-full flex-col overflow-hidden">
      {post.image && (
        <div className="relative aspect-[2/1] w-full shrink-0 border-b border-white/10 bg-gradient-to-br from-violet/10 to-void">
          <Image
            src={post.image.src}
            alt={post.image.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain p-5 opacity-90 transition group-hover:opacity-100"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="content-chip">{post.category}</span>
          {post.featured && <span className="text-[10px] font-bold uppercase tracking-wide text-ultraviolet">Destaque</span>}
          <time dateTime={post.publishedAt} className="micro-label">{formatNewsShortDate(post.publishedAt)}</time>
        </div>
        <h3 id={headingId} className="mt-4 text-lg font-bold leading-6 text-ink">
          <Link href={`/news/${post.slug}`} className="after:absolute after:inset-0 after:rounded-xl hover:text-ultraviolet focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ultraviolet">{post.title}</Link>
        </h3>
        <p className="mt-3 flex-1 text-sm leading-6 text-muted">{post.excerpt}</p>
        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((tag) => (
              <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">{tag}</li>
            ))}
          </ul>
        )}
        <span className="mt-4 inline-flex items-center gap-2 border-t border-white/10 pt-3 text-xs font-bold text-ultraviolet">
          Ler notícia <ArrowRight size={15} aria-hidden="true" className="transition group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
