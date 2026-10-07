"use client";

import { BookOpen, CalendarDays, Compass, HelpCircle, Newspaper, Search, ShieldCheck, User, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useEffectEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Highlight } from "./highlight";
import {
  clearRecentSearches,
  getRecentSearchesServerSnapshot,
  getRecentSearchesSnapshot,
  parseRecentSearches,
  saveRecentSearch,
  subscribeRecentSearches,
} from "@/lib/recent-searches";
import { searchSite, type SearchGroupId, type SearchResult } from "@/lib/site-search";

const GROUP_ICONS: Record<SearchGroupId, LucideIcon> = {
  jogador: User,
  noticias: Newspaper,
  eventos: CalendarDays,
  wiki: BookOpen,
  regras: ShieldCheck,
  faq: HelpCircle,
  paginas: Compass,
};

const QUICK_LINKS = [
  { href: "/store", label: "Loja" },
  { href: "/play", label: "Jogar" },
  { href: "/status", label: "Status" },
  { href: "/rules", label: "Regras" },
  { href: "/faq", label: "FAQ" },
  { href: "/online", label: "Online" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/** Global open shortcuts: Ctrl/Cmd+K anywhere, "/" when not typing. */
export function useSiteSearchHotkeys(enabled: boolean, onOpen: () => void) {
  const openFromEvent = useEffectEvent(onOpen);
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (enabled) return;
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openFromEvent();
        return;
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !event.repeat && !isTypingTarget(event.target)) {
        event.preventDefault();
        openFromEvent();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}

export function SiteSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeFromEffect = useEffectEvent(onClose);
  const router = useRouter();

  const recentRaw = useSyncExternalStore(subscribeRecentSearches, getRecentSearchesSnapshot, getRecentSearchesServerSnapshot);
  const recents = useMemo(() => parseRecentSearches(recentRaw), [recentRaw]);
  const groups = useMemo(() => searchSite(query), [query]);
  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const safeIndex = activeIndex < flat.length ? activeIndex : 0;
  const optionId = (index: number) => `site-search-option-${index}`;

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromEffect();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      const previous = previousFocusRef.current;
      if (previous && previous !== document.body && previous.isConnected) {
        previous.focus();
        return;
      }
      for (const trigger of document.querySelectorAll<HTMLElement>("[data-search-trigger]")) {
        if (trigger.offsetParent !== null) { trigger.focus(); break; }
      }
    };
  }, []);

  function choose(item: SearchResult) {
    if (query.trim()) saveRecentSearch(query);
    onClose();
    router.push(item.href);
  }

  function moveActive(delta: number) {
    if (!flat.length) return;
    const next = (safeIndex + delta + flat.length) % flat.length;
    setActiveIndex(next);
    document.getElementById(optionId(next))?.scrollIntoView({ block: "nearest" });
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); moveActive(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); moveActive(-1); }
    else if (event.key === "Enter") {
      const item = flat[safeIndex];
      if (item) { event.preventDefault(); choose(item); }
    }
  }

  const looksLikeUsername = /^[A-Za-z0-9_]{1,32}$/.test(query.trim());

  return (
    <div className="fixed inset-0 z-[95]" role="presentation">
      <button type="button" onClick={onClose} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" aria-label="Fechar busca" />
      <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-2xl px-3 pt-[8vh] sm:px-6" role="presentation">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="site-search-title"
          tabIndex={-1}
          className="overflow-hidden rounded-2xl border border-white/10 bg-void/95 shadow-2xl shadow-black/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
            <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
            <label id="site-search-title" htmlFor="site-search-input" className="sr-only">Buscar no site</label>
            <input
              id="site-search-input"
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={flat.length > 0 ? "site-search-results" : undefined}
              aria-autocomplete="list"
              aria-activedescendant={flat.length > 0 ? optionId(safeIndex) : undefined}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={handleInputKeyDown}
              placeholder="Buscar notícias, regras, eventos, jogador…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={64}
              className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
            />
            <button type="button" onClick={onClose} className="icon-button !h-9 !w-9 shrink-0" aria-label="Fechar busca">
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="max-h-[min(62vh,520px)] overflow-y-auto p-3">
            {query.trim() === "" && (
              <div className="space-y-4">
                {recents.length > 0 && (
                  <section aria-labelledby="site-search-recents-title">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <p id="site-search-recents-title" className="micro-label">Buscas recentes</p>
                      <button type="button" onClick={() => clearRecentSearches()} className="min-h-9 rounded px-1 text-xs font-bold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">Limpar histórico</button>
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {recents.map((item) => (
                        <li key={item}>
                          <button type="button" onClick={() => { setQuery(item); setActiveIndex(0); inputRef.current?.focus(); }} className="button-secondary !min-h-9 !px-3 !normal-case !tracking-normal !text-xs">
                            {item}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="site-search-quick-title">
                  <p id="site-search-quick-title" className="micro-label px-1">{recents.length > 0 ? "Acesso rápido" : "Comece a digitar ou acesse rapidamente"}</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {QUICK_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link href={link.href} onClick={onClose} className="button-secondary !min-h-9 !px-3 !normal-case !tracking-normal !text-xs">
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
                <p className="px-1 text-xs leading-5 text-muted">Atalhos: <strong className="font-bold text-muted">Ctrl+K</strong> / <strong className="font-bold text-muted">⌘K</strong> abrem a busca; <strong className="font-bold text-muted">/</strong> também abre quando você não está digitando.</p>
              </div>
            )}

            {query.trim() !== "" && flat.length === 0 && (
              <div className="px-2 py-8 text-center">
                <p className="text-base font-bold text-ink">Nenhum resultado para “{query.trim()}”</p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                  {looksLikeUsername
                    ? "Nomes de jogador têm 3 a 16 caracteres: letras, números ou sublinhado (_). Verifique o termo buscado."
                    : "Tente outras palavras, abra as páginas rápidas abaixo ou use o buscador da loja em /store."}
                </p>
                <ul className="mt-5 flex flex-wrap justify-center gap-2">
                  {QUICK_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} onClick={onClose} className="button-secondary !min-h-9 !px-3 !normal-case !tracking-normal !text-xs">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {flat.length > 0 && (
              <div id="site-search-results" role="listbox" aria-label="Resultados da busca">
                {groups.map((group) => (
                  <div key={group.id} role="group" aria-label={group.label} className="mb-3 last:mb-0">
                    <p aria-hidden="true" className="micro-label px-1 pb-1">{group.label}</p>
                    {group.items.map((item) => {
                      const index = flat.findIndex((candidate) => candidate.id === item.id);
                      const Icon = GROUP_ICONS[group.id];
                      const isActive = index === safeIndex;
                      return (
                        <div
                          key={item.id}
                          id={optionId(index)}
                          role="option"
                          aria-selected={isActive}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => choose(item)}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${isActive ? "border-violet/50 bg-violet/15" : "border-transparent hover:bg-white/5"}`}
                        >
                          <span aria-hidden="true" className="icon-well !h-9 !w-9 shrink-0"><Icon size={17} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-ink"><Highlight text={item.title} query={query} /></span>
                            {item.snippet && <span className="mt-0.5 block truncate text-xs leading-5 text-muted"><Highlight text={item.snippet} query={query} /></span>}
                          </span>
                          {item.meta && <span className="micro-label shrink-0">{item.meta}</span>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {query.trim() !== "" && flat.length > 0 && (
              <p role="status" className="sr-only">{flat.length} {flat.length === 1 ? "resultado" : "resultados"} para “{query.trim()}”. Use as setas para navegar e Enter para abrir.</p>
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-white/[0.08] bg-black/30 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            <span>↑↓ navegar</span>
            <span>↵ abrir</span>
            <span>esc fechar</span>
            <span className="ml-auto hidden sm:inline">Ctrl+K / ⌘K abrem a busca</span>
          </div>
        </div>
      </div>
    </div>
  );
}
