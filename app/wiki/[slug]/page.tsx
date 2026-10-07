import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { GuideCard } from "@/components/wiki/guide-card";
import { WikiBody } from "@/components/wiki/wiki-body";
import { getAdjacentGuides, getGuideBySlug, getPublishedGuides, getRelatedGuides } from "@/data/wiki";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getPublishedGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return { title: "Guia não encontrado | Wiki | SWIFT MC" };
  return {
    title: `${guide.title} | Wiki | SWIFT MC`,
    description: guide.description,
    openGraph: { type: "article", title: guide.title, description: guide.description },
  };
}

const tocLink = "rounded-lg border border-white/10 bg-card px-3 py-2 text-xs font-bold text-muted transition hover:border-violet/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet lg:border-transparent lg:border-l-2 lg:bg-transparent lg:px-3 lg:py-2 lg:text-sm lg:hover:border-violet lg:hover:bg-violet/10";

export default async function WikiGuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  const related = getRelatedGuides(guide);
  const { previous, next } = getAdjacentGuides(slug);

  return (
    <>
      <SiteHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <Link href="/wiki" className="inline-flex min-h-11 items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para a Wiki
          </Link>

          <header className="mt-6 max-w-3xl">
            <span className="rank-badge rank-badge-featured">{guide.category}</span>
            <h1 className="mt-5 text-3xl font-extrabold uppercase leading-tight tracking-tight text-ink sm:text-4xl sm:leading-[1.15]">{guide.title}</h1>
            <p className="mt-4 text-base leading-7 text-muted">{guide.description}</p>
            {guide.tags && guide.tags.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2" aria-label="Tags">
                {guide.tags.map((tag) => (
                  <li key={tag} className="rounded-md border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted">{tag}</li>
                ))}
              </ul>
            )}
          </header>

          <div className="mt-10 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
            <nav aria-label="Nesta página" className="glass-panel mb-8 p-4 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
              <p className="micro-label">Nesta página</p>
              <ul className="mt-3 flex flex-wrap gap-2 lg:flex-col lg:gap-2">
                {guide.sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className={`inline-flex min-h-10 items-center ${tocLink}`}>{section.title}</a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0">
              <WikiBody sections={guide.sections} />
            </div>
          </div>

          {related.length > 0 && (
            <section aria-labelledby="related-guides-title" className="mt-14 border-t border-white/[0.06] pt-10">
              <h2 id="related-guides-title" className="text-2xl font-bold text-ink">Guias relacionados</h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => <GuideCard key={item.slug} guide={item} />)}
              </div>
            </section>
          )}

          {(previous || next) && (
            <nav aria-label="Navegação entre guias da categoria" className="mt-12 flex flex-col gap-3 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-stretch sm:justify-between">
              {previous ? (
                <Link href={`/wiki/${previous.slug}`} className="group flex max-w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-card/70 px-4 py-3 transition hover:border-violet/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:max-w-[45%]">
                  <ChevronLeft size={18} aria-hidden="true" className="shrink-0 text-ultraviolet transition group-hover:-translate-x-0.5" />
                  <span className="min-w-0">
                    <span className="micro-label">Guia anterior</span>
                    <span className="mt-1 block truncate text-sm font-bold text-ink">{previous.title}</span>
                  </span>
                </Link>
              ) : <span aria-hidden="true" className="hidden sm:block sm:max-w-[45%]" />}
              {next && (
                <Link href={`/wiki/${next.slug}`} className="group flex max-w-full items-center justify-end gap-3 rounded-xl border border-white/[0.08] bg-card/70 px-4 py-3 transition hover:border-violet/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet sm:max-w-[45%] sm:text-right">
                  <span className="min-w-0">
                    <span className="micro-label">Próximo guia</span>
                    <span className="mt-1 block truncate text-sm font-bold text-ink">{next.title}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-ultraviolet transition group-hover:translate-x-0.5" />
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
