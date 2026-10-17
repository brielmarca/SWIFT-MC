"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { filterRuleSections, regulations } from "@/data/official-rules";

const focusStyle = "rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet";

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return paragraphs.map((paragraph, index) => paragraph.startsWith("- ") ? (
    <ul key={index} className="list-disc space-y-2 pl-6">{paragraph.split("\n").map((line) => <li key={line}>{line.slice(2)}</li>)}</ul>
  ) : <p key={index}>{paragraph}</p>);
}

export function RulesGuide() {
  const [active, setActive] = useState("servidor");
  const [query, setQuery] = useState("");
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [navigation, setNavigation] = useState<{ id: string } | null>(null);

  const revealAnchor = useCallback(() => {
    let id: string;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
    const regulation = regulations.find((item) => item.id === id || item.sections.some((section) =>
      section.id === id || section.id.replace("-section-", "-") === id || section.blocks.some((block) => block.id === id)));
    if (!regulation) return;
    setActive(regulation.id);
    setQuery("");
    setNavigation({ id });
  }, []);

  useEffect(() => {
    const initial = requestAnimationFrame(revealAnchor);
    window.addEventListener("hashchange", revealAnchor);
    window.addEventListener("popstate", revealAnchor);
    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener("hashchange", revealAnchor);
      window.removeEventListener("popstate", revealAnchor);
    };
  }, [revealAnchor]);

  // Runs after React commits the selected panel and the cleared search results.
  useEffect(() => {
    if (!navigation) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(navigation.id);
      if (!target || target.closest("[hidden]")) return;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [navigation]);

  function selectTab(index: number) {
    const id = regulations[index].id;
    setActive(id);
    setQuery("");
    setNavigation(null);
    window.history.pushState(window.history.state, "", `#${id}`);
  }

  return <div onClick={(event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href^='#']");
    if (!link) return;
    event.preventDefault();
    if (window.location.hash !== link.hash) window.history.pushState(window.history.state, "", link.hash);
    revealAnchor();
  }}>
    <div role="tablist" aria-label="Regulamentos SwiftMC" className="mb-6 flex gap-3">
      {regulations.map((regulation, index) => <button key={regulation.id} ref={(node) => { tabs.current[index] = node; }}
        type="button" role="tab" id={`${regulation.id}-tab`} aria-controls={regulation.id} aria-selected={active === regulation.id}
        tabIndex={active === regulation.id ? 0 : -1} onClick={() => selectTab(index)}
        onKeyDown={(event) => {
          let next: number;
          if (event.key === "ArrowRight") next = (index + 1) % regulations.length;
          else if (event.key === "ArrowLeft") next = (index + regulations.length - 1) % regulations.length;
          else if (event.key === "Home") next = 0;
          else if (event.key === "End") next = regulations.length - 1;
          else return;
          event.preventDefault();
          selectTab(next);
          tabs.current[next]?.focus();
        }}
        className={`min-h-12 flex-1 border px-5 py-3 font-bold sm:flex-none ${focusStyle} ${active === regulation.id ? "border-ultraviolet bg-violet/20 text-ink" : "border-white/20 text-slate-300"}`}>{regulation.label}</button>)}
    </div>
    {regulations.map((regulation) => {
      const sections = filterRuleSections(regulation.sections, active === regulation.id ? query : "");
      return <div key={regulation.id} id={regulation.id} role="tabpanel" aria-labelledby={`${regulation.id}-tab`} hidden={active !== regulation.id} tabIndex={0} className={`scroll-mt-28 ${focusStyle}`}>
        <header className="content-panel space-y-4 p-5 text-sm leading-7 text-slate-300 sm:p-6">
          <h2 className="text-xl font-extrabold text-ink">{regulation.title}</h2>
          <Paragraphs paragraphs={regulation.introduction} />
        </header>
        <div className="my-6">
          <label htmlFor={`${regulation.id}-search`} className="micro-label">Buscar em {regulation.label} por assunto ou ID</label>
          <input id={`${regulation.id}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-controls={`${regulation.id}-results`} placeholder="Ex.: 1.1, respeito, segurança" className="checkout-input mt-2" />
          <div className="mt-3 flex min-h-11 items-center justify-between gap-3">
            <p role="status" className="text-sm text-slate-300">{sections.length} de {regulation.sections.length} seções</p>
            {query && <button type="button" onClick={() => setQuery("")} className="network-action">Limpar busca</button>}
          </div>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label={`Seções — ${regulation.label}`} className="content-panel p-4 lg:sticky lg:top-28">
            <p className="micro-label mb-3">Seções</p>
            <ul className="space-y-1">{regulation.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} onClick={() => setQuery("")} className={`block px-2 py-3 text-xs font-semibold leading-5 text-slate-300 hover:bg-violet/10 hover:text-ink ${focusStyle}`}>{section.title}</a></li>)}</ul>
          </nav>
          <div id={`${regulation.id}-results`} className="min-w-0 space-y-6">
            {!sections.length && <p className="content-panel p-6 text-slate-300">Nenhum resultado encontrado. Tente outro termo ou limpe a busca.</p>}
            {sections.map((section) => <section key={section.id} id={section.id} tabIndex={-1} aria-labelledby={`${section.id}-title`} className={`content-panel scroll-mt-28 p-5 target:border-ultraviolet sm:p-6 ${focusStyle}`}>
              <span id={section.id.replace("-section-", "-")} tabIndex={-1} className={`block scroll-mt-28 ${focusStyle}`} aria-label={section.title} />
              <h3 id={`${section.id}-title`} className="mb-5 text-base font-extrabold leading-7 text-ink"><a href={`#${section.id}`} className={focusStyle}>{section.title}</a></h3>
              <div className="space-y-4">{section.blocks.map((block) => <div key={block.id} id={block.id} tabIndex={-1} className={`scroll-mt-28 space-y-3 border-t border-white/10 pt-4 text-sm leading-7 text-slate-300 target:rounded-lg target:bg-violet/10 ${focusStyle}`}>
                <Paragraphs paragraphs={block.paragraphs} />
              </div>)}</div>
            </section>)}
            <footer className="content-panel space-y-4 p-5 text-sm leading-7 text-slate-300 sm:p-6"><Paragraphs paragraphs={regulation.closing} /></footer>
          </div>
        </div>
      </div>;
    })}
  </div>;
}
