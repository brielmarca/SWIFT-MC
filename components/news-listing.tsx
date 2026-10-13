"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper, RotateCcw, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { filterNews, getNewsCategories, getNewsTags, type NewsPost } from "@/data/content";
import { formatNewsShortDate } from "@/lib/content-format";
import { ArticleCard } from "./content/article-card";
import { ContentEmpty } from "./content/content-empty";

const PAGE_SIZE = 6;

export function NewsListing({ posts }: { posts: readonly NewsPost[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [tag, setTag] = useState("Todos");
  const [page, setPage] = useState(1);
  const searchId = useId();

  const categories = useMemo(() => ["Todas", ...getNewsCategories(posts)], [posts]);
  const tags = useMemo(() => ["Todos", ...getNewsTags(posts)], [posts]);
  const hasFilters = query.trim() !== "" || category !== "Todas" || tag !== "Todos";
  const filtered = useMemo(() => filterNews(posts, { query, category, tag }), [posts, query, category, tag]);
  const featured = hasFilters ? undefined : filtered[0];
  const list = featured ? filtered.filter((post) => post.slug !== featured.slug) : filtered;

  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageItems = list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const resetFilters = () => { setQuery(""); setCategory("Todas"); setTag("Todos"); setPage(1); };

  if (posts.length === 0) {
    return <ContentEmpty title="Nenhuma publicação disponível" description="As notícias do SWIFT MC aparecerão aqui assim que forem publicadas." />;
  }

  return <div>
    <div className="content-panel border-violet/25 p-5 sm:p-6">
      <label htmlFor={searchId} className="micro-label">Buscar notícias</label>
      <div className="relative mt-2">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
        <input id={searchId} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Ex.: economia, temporada, torneio" className="checkout-input !pl-12" />
      </div>
      <fieldset className="mt-5">
        <legend className="micro-label mb-2">Categorias</legend>
        <div className="flex flex-wrap gap-2">{categories.map((name) => <button key={name} type="button" aria-pressed={category === name} onClick={() => { setCategory(name); setPage(1); }} className="content-filter">{name}</button>)}</div>
      </fieldset>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor={`${searchId}-tag`} className="micro-label">Tag</label>
        <select id={`${searchId}-tag`} value={tag} onChange={(event) => { setTag(event.target.value); setPage(1); }} className="checkout-input !min-h-11 !w-auto max-w-full !py-2 !text-sm">{tags.map((name) => <option key={name} value={name}>{name}</option>)}</select>
      </div>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">{filtered.length} {filtered.length === 1 ? "notícia encontrada" : "notícias encontradas"}{hasFilters ? ` de ${posts.length}` : " · Mais recentes primeiro"}</p>
        {hasFilters && <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><RotateCcw size={15} aria-hidden="true" /> Limpar filtros</button>}
      </div>
    </div>

    {featured && <article className="content-card group mt-6 overflow-hidden border-violet/30 bg-gradient-to-br from-violet/10 to-card">
      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="relative min-h-44 border-b border-white/10 bg-void/40 md:border-b-0 md:border-r">
          {featured.image ? (
            <Image src={featured.image.src} alt={featured.image.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain p-6" priority />
          ) : (
            <div className="absolute inset-0 grid place-items-center"><Newspaper size={48} aria-hidden="true" className="text-violet/50" /></div>
          )}
        </div>
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-ultraviolet">Última publicação{featured.featured ? " · Destaque" : ""}</span>
            <span className="content-chip">{featured.category}</span>
            <time dateTime={featured.publishedAt} className="micro-label">{formatNewsShortDate(featured.publishedAt)}</time>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold leading-8 text-ink">
            <Link href={`/news/${featured.slug}`} className="after:absolute after:inset-0 after:rounded-xl hover:text-ultraviolet focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ultraviolet">{featured.title}</Link>
          </h2>
          <p className="mt-3 flex-1 text-sm leading-6 text-muted">{featured.excerpt}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-ultraviolet">
            Ler notícia <ArrowRight size={16} aria-hidden="true" className="transition group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>}

    {list.length === 0 && hasFilters ? (
      <div className="mt-6"><ContentEmpty title="Nenhum resultado encontrado" description="Tente outro termo ou use “Limpar filtros” para ver todas as notícias."><button type="button" onClick={resetFilters} className="network-action">Limpar filtros</button></ContentEmpty></div>
    ) : (
      <section className="mt-6" aria-label="Publicações"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((post) => <ArticleCard key={post.slug} post={post} headingId={`news-card-${post.slug}`} />)}
      </div></section>
    )}

    {pageCount > 1 && list.length > 0 && (
      <nav aria-label="Paginação de notícias" className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button type="button" disabled={current === 1} onClick={() => setPage(current - 1)} className="network-action disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
        <p role="status" className="text-sm text-muted">Página {current} de {pageCount}</p>
        <button type="button" disabled={current === pageCount} onClick={() => setPage(current + 1)} className="network-action disabled:cursor-not-allowed disabled:opacity-40">Próxima</button>
      </nav>
    )}
  </div>;
}
