"use client";

import { useEffect, useId, useState } from "react";
import { Link as LinkIcon, Plus, Search } from "lucide-react";
import { filterGuides, type GuideEntry } from "@/data/player-guides";

export function SearchableGuide({ entries, kind }: { entries: readonly GuideEntry[]; kind: "rules" | "faq" }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const inputId = useId();
  const categories = ["Todas", ...new Set(entries.map((entry) => entry.category))];
  const matches = filterGuides(entries, query, category);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function revealAnchor() {
      const id = window.location.hash.slice(1);
      if (!entries.some((entry) => entry.id === id)) return;
      setQuery("");
      setCategory("Todas");
      clearTimeout(timer);
      timer = setTimeout(() => {
        const details = document.getElementById(id);
        if (details instanceof HTMLDetailsElement) {
          details.open = true;
          details.scrollIntoView({ block: "start" });
          details.querySelector("summary")?.focus({ preventScroll: true });
        }
      }, 0);
    }
    const initial = setTimeout(revealAnchor, 0);
    window.addEventListener("hashchange", revealAnchor);
    return () => { clearTimeout(initial); clearTimeout(timer); window.removeEventListener("hashchange", revealAnchor); };
  }, [entries]);

  return <div>
    <div className="glass-panel p-5 sm:p-6">
      <label htmlFor={inputId} className="micro-label">{kind === "rules" ? "Buscar regras por assunto ou ID" : "Buscar perguntas"}</label>
      <div className="relative mt-2">
        <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
        <input id={inputId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "rules" ? "Ex.: R01, chat, terrenos" : "Ex.: versão, conta, VIP"} className="checkout-input !pl-12" />
      </div>
      <fieldset className="mt-5">
        <legend className="micro-label mb-2">Categorias</legend>
        <div className="flex flex-wrap gap-2">{categories.map((name) => <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${category === name ? "border-violet bg-violet/15 text-ultraviolet" : "border-white/10 bg-card text-muted hover:text-ink"}`}>{name}</button>)}</div>
      </fieldset>
      <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" role="status">{matches.length} {matches.length === 1 ? "resultado encontrado" : "resultados encontrados"}</p>
        <button type="button" onClick={() => { setQuery(""); setCategory("Todas"); }} className="min-h-11 rounded px-2 text-sm font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">Limpar filtros</button>
      </div>
    </div>
    {matches.length === 0 && <div className="glass-panel mt-6 p-8 text-center"><h2 className="text-xl font-bold text-ink">Nenhum resultado encontrado</h2><p className="mt-3 text-sm leading-6 text-muted">Tente outro termo ou use “Limpar filtros” para ver todos os assuntos.</p></div>}
    <div className="mt-8 space-y-8">
      {categories.filter((name) => name !== "Todas").map((name) => {
        const group = matches.filter((entry) => entry.category === name);
        if (!group.length) return null;
        return <section key={name} aria-label={name}>
          <h2 className="mb-4 text-xl font-bold uppercase text-ink">{name}</h2>
          <div className="space-y-3">{group.map((entry) => <details id={entry.id} key={entry.id} className="group scroll-mt-28 rounded-xl border border-white/10 bg-card/80 p-4 open:border-violet/40 sm:p-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded text-base font-bold leading-6 text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet [&::-webkit-details-marker]:hidden">
              <span>{kind === "rules" && <span className="mr-3 font-mono text-sm text-ultraviolet">{entry.id}</span>}{entry.title}</span>
              <Plus size={18} aria-hidden="true" className="shrink-0 text-ultraviolet transition-transform group-open:rotate-45" />
            </summary>
            <p className="mt-4 max-w-3xl border-t border-white/10 pt-4 text-base leading-7 text-muted">{entry.body}</p>
            <a href={`#${entry.id}`} aria-label={`Link direto: ${entry.title}`} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded text-sm font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><LinkIcon size={15} aria-hidden="true" /> Link direto · {entry.id}</a>
          </details>)}</div>
        </section>;
      })}
    </div>
  </div>;
}
