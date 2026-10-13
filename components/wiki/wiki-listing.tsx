"use client";

import Link from "next/link";
import { BookOpen, RotateCcw, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { filterWikiGuides, WIKI_CATEGORIES, type WikiGuide } from "@/data/wiki";
import { GuideCard } from "./guide-card";
import { ContentEmpty } from "../content/content-empty";

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

  if (guides.length === 0) {
    return <ContentEmpty title="Nenhum guia publicado ainda" description="Os guias do SWIFT MC aparecerão aqui assim que forem publicados. Enquanto isso, confira as perguntas frequentes."><Link href="/faq" className="network-action">Ir para o FAQ</Link></ContentEmpty>;
  }

  return <div>
    <div className="content-panel border-violet/25 p-5 sm:p-6">
      <label htmlFor={searchId} className="micro-label">Buscar guias</label>
      <div className="relative mt-2">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
        <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: comandos, economia, entrar" className="checkout-input !pl-12" />
      </div>
      <fieldset className="mt-5">
        <legend className="micro-label mb-2">Categorias</legend>
        <div className="flex flex-wrap gap-2">
          {["Todas", ...WIKI_CATEGORIES].map((name) => (
            <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className="content-filter">
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="icon-well !h-9 !w-9"><BookOpen size={17} aria-hidden="true" /></span>
          <h2 id="featured-guides-title" className="text-lg font-extrabold text-ink">Guias em destaque</h2>
          {(counts.get("Primeiros passos") ?? 0) > 0 && <button type="button" onClick={() => setCategory("Primeiros passos")} className="network-action ml-auto">Primeiros passos</button>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((guide) => <GuideCard key={guide.slug} guide={guide} headingId={`wiki-featured-${guide.slug}`} />)}
        </div>
      </section>
    )}

    {(list.length > 0 || hasFilters) && <section aria-labelledby="guide-list-title" className="mt-8">
      <h2 id="guide-list-title" className="text-lg font-extrabold text-ink">{category === "Todas" ? featured.length ? "Explore os guias" : "Todos os guias" : category}</h2>
      {list.length === 0 ? (
        <div className="mt-4"><ContentEmpty title={emptyCategory ? `Nenhum guia na categoria “${category}” ainda` : `Nenhum resultado para “${query.trim()}”`} description={emptyCategory
              ? "Esta categoria ainda não tem guias publicados. Escolha outra categoria ou veja todos os guias."
               : "Tente outras palavras ou use “Limpar filtros” para ver todos os guias."}>
          <button type="button" onClick={resetFilters} className="network-action">Ver todos os guias</button>
        </ContentEmpty></div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((guide) => <GuideCard key={guide.slug} guide={guide} headingId={`wiki-card-${guide.slug}`} />)}
        </div>
      )}
    </section>}
  </div>;
}
