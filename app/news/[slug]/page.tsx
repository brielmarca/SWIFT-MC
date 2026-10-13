import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/content/article-card";
import { ContentPage } from "@/components/content/content-page";
import { getNewsBySlug, getPublishedNews, getRelatedNews, type ArticleBlock } from "@/data/content";
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
  if (block.type === "heading") return <h2 className="content-heading mt-8 border-t border-white/10 pt-8">{block.text}</h2>;
  if (block.type === "list") {
    return (
      <ul className="mt-5 max-w-3xl space-y-3">
        {block.items.map((item) => (
          <li key={item} className="content-prose flex gap-3">
            <span aria-hidden="true" className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-ultraviolet" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  return <p className="content-prose mt-5 first:mt-0">{block.text}</p>;
}

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const post = getNewsBySlug(slug);
  if (!post) notFound();
  const related = getRelatedNews(post);
  const morePosts = related.length ? related : getPublishedNews().filter((item) => item.slug !== post.slug).slice(0, 3);

  return (
    <ContentPage active="/news" title={post.title} description={post.excerpt} backLabel="Voltar para notícias" metadata={<>
              <span className="content-chip">{post.category}</span>
              <time dateTime={post.publishedAt} className="micro-label">Publicado em {formatNewsDate(post.publishedAt)}</time>
            {post.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted">{tag}</li>
                ))}
              </ul>
            )}
          </>}>

          {post.image && (
            <div className="relative mx-auto mb-6 aspect-[3/1] w-full max-w-4xl overflow-hidden rounded-xl border border-violet/20 bg-gradient-to-br from-violet/10 to-void">
              <Image src={post.image.src} alt={post.image.alt} fill sizes="(max-width: 896px) 100vw, 896px" className="object-contain p-5" priority />
            </div>
          )}

          <article className="content-panel mx-auto max-w-4xl p-5 sm:p-8" aria-label={post.title}><div className="mx-auto max-w-[68ch]">
            {post.content.map((block, index) => <ArticleBody key={index} block={block} />)}
          </div></article>

          {morePosts.length > 0 && (
            <section aria-labelledby="related-news-title" className="mt-8 border-t border-white/10 pt-6">
              <h2 id="related-news-title" className="text-lg font-extrabold text-ink">{related.length ? "Notícias relacionadas" : "Últimas notícias"}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {morePosts.map((item) => <ArticleCard key={item.slug} post={item} />)}
              </div>
            </section>
          )}
    </ContentPage>
  );
}
