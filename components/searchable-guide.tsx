"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Link as LinkIcon, RotateCcw, Search, ShieldAlert } from "lucide-react";
import { filterGuides, type GuideEntry } from "@/data/player-guides";
import { ContentEmpty } from "./content/content-empty";

export function SearchableGuide({ entries, kind }: { entries: readonly GuideEntry[]; kind: "rules" | "faq" }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const categories = ["Todas", ...new Set(entries.map((entry) => entry.category))];
  const matches = filterGuides(entries, query, category);
  const hasFilters = query.trim() !== "" || category !== "Todas";

  function resetFilters() {
    setQuery("");
    setCategory("Todas");
    inputRef.current?.focus();
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function revealAnchor() {
      const id = window.location.hash.slice(1);
      const groupIds = [...new Set(entries.map((entry) => entry.category))].map((_, index) => `${kind}-category-${index + 1}`);
      if (!entries.some((entry) => entry.id === id) && !groupIds.includes(id)) return;
      setQuery("");
      setCategory("Todas");
      clearTimeout(timer);
      timer = setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          if (target instanceof HTMLDetailsElement) target.open = true;
          target.scrollIntoView({ block: "start" });
          (target.querySelector("summary") ?? target).focus({ preventScroll: true });
        }
      }, 0);
    }
    const initial = setTimeout(revealAnchor, 0);
    window.addEventListener("hashchange", revealAnchor);
    return () => { clearTimeout(initial); clearTimeout(timer); window.removeEventListener("hashchange", revealAnchor); };
  }, [entries, kind]);

  return <div>
    <div className="content-panel border-violet/25 p-5 sm:p-6">
      <label htmlFor={inputId} className="micro-label">{kind === "rules" ? "Buscar regras por assunto ou ID" : "Buscar perguntas"}</label>
      <div className="relative mt-2">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
        <input ref={inputRef} id={inputId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "rules" ? "Ex.: R01, chat, terrenos" : "Ex.: versão, conta, VIP"} aria-controls={`${inputId}-results`} className="checkout-input !pl-12" />
      </div>
      <fieldset className="mt-5">
        <legend className="micro-label mb-2">Categorias</legend>
        <div className="flex flex-wrap gap-2">{categories.map((name) => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className="content-filter">{name}<span className="ml-2 tabular-nums opacity-70">{name === "Todas" ? entries.length : entries.filter((entry) => entry.category === name).length}</span></button>)}</div>
      </fieldset>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 text-muted" role="status">{matches.length} {kind === "rules" ? matches.length === 1 ? "regra encontrada" : "regras encontradas" : matches.length === 1 ? "pergunta encontrada" : "perguntas encontradas"}{hasFilters ? ` de ${entries.length}` : ""}</p>
        {hasFilters && <button type="button" onClick={resetFilters} className="network-action"><RotateCcw size={14} aria-hidden="true" />Limpar filtros</button>}
      </div>
    </div>
    <div id={`${inputId}-results`} className="mt-6 space-y-8">
      {matches.length === 0 && <ContentEmpty title="Nenhum resultado encontrado" description="Tente outro termo ou use “Limpar filtros” para ver todos os assuntos."><button type="button" onClick={resetFilters} className="network-action">Limpar filtros</button></ContentEmpty>}
      {categories.filter((name) => name !== "Todas").map((name, index) => {
        const group = matches.filter((entry) => entry.category === name);
        if (!group.length) return null;
        const sectionId = `${kind}-category-${index + 1}`;
        return <section key={name} id={sectionId} tabIndex={-1} aria-labelledby={`${sectionId}-title`} className="scroll-mt-28 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
          <div className="mb-3 flex items-center gap-3">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-violet/25 bg-violet/10 font-mono text-xs font-bold text-ultraviolet">{String(index + 1).padStart(2, "0")}</span>
            <h2 id={`${sectionId}-title`} className="text-lg font-extrabold text-ink">{name}</h2>
            <a href={`#${sectionId}`} aria-label={`Link direto da categoria: ${name}`} className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><LinkIcon size={16} aria-hidden="true" /></a>
          </div>
          <div className={kind === "rules" ? "grid gap-3 lg:grid-cols-2" : "space-y-3"}>{group.map((entry) => kind === "rules" ? (
            <article id={entry.id} key={entry.id} tabIndex={-1} aria-labelledby={`${entry.id}-title`} className={`content-panel min-w-0 scroll-mt-28 p-5 transition target:border-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${entry.id === "R07" ? "border-amber-300/25 bg-amber-300/[0.03]" : ""}`}>
              <div className="flex items-start gap-3"><span className="mt-0.5 font-mono text-sm font-bold text-ultraviolet">{entry.id}</span><h3 id={`${entry.id}-title`} className="text-base font-bold leading-6 text-ink">{entry.title}</h3>{entry.id === "R07" && <ShieldAlert size={19} aria-hidden="true" className="ml-auto shrink-0 text-amber-200" />}</div>
              <p className="mt-3 text-sm leading-7 text-slate-300">{entry.body}</p>
              <a href={`#${entry.id}`} aria-label={`Link direto: ${entry.title}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded text-xs font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><LinkIcon size={14} aria-hidden="true" />Link direto · {entry.id}</a>
            </article>
          ) : (
            <details id={entry.id} key={entry.id} className="content-panel group scroll-mt-28 overflow-hidden transition open:border-violet/40 open:bg-violet/[0.04] target:border-ultraviolet">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold leading-6 text-ink hover:bg-violet/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ultraviolet [&::-webkit-details-marker]:hidden">
                <h3 className="text-sm font-bold leading-6">{entry.title}</h3>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-violet/20 bg-violet/10 text-ultraviolet"><ChevronDown size={16} aria-hidden="true" className="transition-transform group-open:rotate-180" /></span>
              </summary>
              <div className="mx-5 border-t border-white/10 pb-4 pt-4"><p className="max-w-[75ch] text-sm leading-7 text-slate-300">{entry.body}</p>
                <a href={`#${entry.id}`} aria-label={`Link direto: ${entry.title}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded text-xs font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><LinkIcon size={14} aria-hidden="true" />Link direto</a>
              </div>
            </details>
          ))}</div>
        </section>;
      })}
    </div>
  </div>;
}
