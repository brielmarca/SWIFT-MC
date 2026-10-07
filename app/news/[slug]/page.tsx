import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleCard } from "@/components/content/article-card";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { getNewsBySlug, getRelatedNews, type ArticleBlock } from "@/data/content";
import { formatNewsDate } from "@/lib/content-format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getNewsBySlug(slug);
  if (!post) return { title: "Notícia não encontrada | SWIFT MC" };
  return {
    title: `${post.title} | SWIFT MC`,
    description: post.excerpt,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
      publishedTime: post.publishedAt,
      ...(post.image ? { images: [{ url: post.image.src, alt: post.image.alt }] } : {}),
    },
  };
}

function ArticleBody({ block }: { block: ArticleBlock }) {
  if (block.type === "heading") return <h2 className="mt-9 text-xl font-bold text-ink">{block.text}</h2>;
  if (block.type === "list") {
    return (
      <ul className="mt-5 max-w-3xl space-y-3">
        {block.items.map((item) => (
          <li key={item} className="flex gap-3 text-base leading-7 text-muted">
            <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-ultraviolet" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="mt-5 max-w-3xl text-base leading-7 text-muted">{block.text}</p>;
}

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getNewsBySlug(slug);
  if (!post) notFound();
  const related = getRelatedNews(post);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Link href="/news" className="inline-flex min-h-11 items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para notícias
          </Link>

          <header className="mt-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="rank-badge rank-badge-featured">{post.category}</span>
              <time dateTime={post.publishedAt} className="micro-label">Publicado em {formatNewsDate(post.publishedAt)}</time>
            </div>
            <h1 className="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight text-ink sm:text-4xl sm:leading-[1.15]">{post.title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{post.excerpt}</p>
            {post.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted">{tag}</li>
                ))}
              </ul>
            )}
          </header>

          {post.image && (
            <div className="relative mt-8 aspect-[2/1] w-full overflow-hidden rounded-xl border border-white/[0.07] bg-void/60">
              <Image src={post.image.src} alt={post.image.alt} fill sizes="(max-width: 896px) 100vw, 896px" className="object-cover" priority />
            </div>
          )}

          <article className="mt-8">
            {post.content.map((block, index) => <ArticleBody key={index} block={block} />)}
          </article>

          {related.length > 0 && (
            <section aria-labelledby="related-news-title" className="mt-14 border-t border-white/[0.06] pt-10">
              <h2 id="related-news-title" className="text-2xl font-bold text-ink">Notícias relacionadas</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {related.map((item) => <ArticleCard key={item.slug} post={item} />)}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
