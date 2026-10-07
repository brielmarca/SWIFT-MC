import { Newspaper } from "lucide-react";
import Link from "next/link";
import { getLatestNews } from "@/data/content";
import { ArticleCard } from "./content/article-card";
import { SectionHeading } from "./section-heading";

/** Homepage "Novidades" section: at most 3 of the latest published posts. */
export function NewsTeaser() {
  const posts = getLatestNews(3);
  return (
    <section id="novidades" className="section-shell scroll-mt-24 border-t border-white/[0.04]">
      <div className="site-container">
        <SectionHeading
          icon={Newspaper}
          eyebrow="Novidades"
          title="Últimas notícias"
          description="Atualizações, guias e avisos da comunidade direto da equipe do SWIFT MC."
        />
        {posts.length > 0 ? (
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => <ArticleCard key={post.slug} post={post} />)}
          </div>
        ) : (
          <p className="mt-12 text-center text-sm text-muted">Nenhuma publicação ainda. Volte em breve.</p>
        )}
        <div className="mt-8 flex justify-center">
          <Link href="/news" className="button-secondary">Ver todas as novidades</Link>
        </div>
      </div>
    </section>
  );
}
