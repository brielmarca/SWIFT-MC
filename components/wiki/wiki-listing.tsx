"use client";

import Link from "next/link";
import { BookOpen, RotateCcw, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { filterWikiGuides, WIKI_CATEGORIES, type WikiGuide } from "@/data/wiki";
import { GuideCard } from "./guide-card";

export function WikiListing({ guides }: { guides: readonly WikiGuide[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const searchId = useId();

  const counts = useMemo(() => {
    const map = new Map<string, number>([["Todas", guides.length]]);
    for (const name of WIKI_CATEGORIES) map.set(name, guides.filter((guide) => guide.category === name).length);
    return map;
  }, [guides]);

  const hasFilters = query.trim() !== "" || category !== "Todas";
  const filtered = useMemo(() => filterWikiGuides(guides, { query, category }), [guides, query, category]);
  const featured = hasFilters ? [] : guides.filter((guide) => guide.featured).slice(0, 3);
  const list = featured.length ? filtered.filter((guide) => !featured.some((item) => item.slug === guide.slug)) : filtered;
  const emptyCategory = !hasFilters ? false : query.trim() === "" && category !== "Todas" && (counts.get(category) ?? 0) === 0;

  const resetFilters = () => { setQuery(""); setCategory("Todas"); };
  const chip = (active: boolean) => `min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${active ? "border-violet bg-violet/15 text-ultraviolet" : "border-white/10 bg-card text-muted hover:text-ink"}`;

  if (guides.length === 0) {
    return <div className="glass-panel p-8 text-center">
      <h2 className="text-xl font-bold text-ink">Nenhum guia publicado ainda</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Os guias do SWIFT MC aparecerão aqui assim que forem publicados. Enquanto isso, confira as perguntas frequentes.</p>
      <Link href="/faq" className="button-secondary mt-5">Ir para o FAQ</Link>
    </div>;
  }

  return <div>
    <div className="glass-panel p-5 sm:p-6">
      <label htmlFor={searchId} className="micro-label">Buscar guias</label>
      <div className="relative mt-2">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: comandos, economia, entrar" className="checkout-input !pl-12" />
      </div>
      <fieldset className="mt-5">
        <legend className="micro-label mb-2">Categorias</legend>
        <div className="flex flex-wrap gap-2">
          {["Todas", ...WIKI_CATEGORIES].map((name) => (
            <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={chip(category === name)}>
              {name} <span className="ml-1 font-bold tabular-nums opacity-70">{counts.get(name) ?? 0}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">{list.length + featured.length} {list.length + featured.length === 1 ? "guia encontrado" : "guias encontrados"}{hasFilters ? ` de ${guides.length}` : ""}</p>
        {hasFilters && <button type="button" onClick={resetFilters} className="inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><RotateCcw size={15} aria-hidden="true" /> Limpar filtros</button>}
      </div>
    </div>

    {featured.length > 0 && (
      <section aria-labelledby="featured-guides-title" className="mt-8">
        <div className="flex items-center gap-3">
          <span className="icon-well !h-9 !w-9"><BookOpen size={17} aria-hidden="true" /></span>
          <h2 id="featured-guides-title" className="text-xl font-bold uppercase text-ink">Guias em destaque</h2>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((guide) => <GuideCard key={guide.slug} guide={guide} headingId={`wiki-featured-${guide.slug}`} />)}
        </div>
      </section>
    )}

    <section aria-labelledby="guide-list-title" className="mt-10">
      <h2 id="guide-list-title" className="text-xl font-bold uppercase text-ink">{category === "Todas" ? "Todos os guias" : category}</h2>
      {list.length === 0 ? (
        <div className="glass-panel mt-5 p-8 text-center">
          <h3 className="text-lg font-bold text-ink">{emptyCategory ? `Nenhum guia na categoria “${category}” ainda` : `Nenhum resultado para “${query.trim()}”`}</h3>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">
            {emptyCategory
              ? "Esta categoria ainda não tem guias publicados. Escolha outra categoria ou veja todos os guias."
              : "Tente outras palavras ou use “Limpar filtros” para ver todos os guias."}
          </p>
          <button type="button" onClick={resetFilters} className="button-secondary mt-5">Ver todos os guias</button>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((guide) => <GuideCard key={guide.slug} guide={guide} headingId={`wiki-card-${guide.slug}`} />)}
        </div>
      )}
    </section>
  </div>;
}
