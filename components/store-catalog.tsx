"use client";

import { Search, SearchX, X } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { ranks } from "@/data/ranks";
import { RankCard } from "./rank-card";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function StoreCatalog() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = normalize(deferredQuery.trim());
  const filteredRanks = ranks.filter((rank) =>
    normalize(`${rank.name} ${rank.description}`).includes(normalizedQuery),
  );

  useEffect(() => {
    if (window.location.hash === "#store-search") {
      document.getElementById("store-search")?.focus();
    }
  }, []);

  return (
    <div>
      <div className="mx-auto max-w-2xl">
        <label htmlFor="store-search" className="micro-label mb-2">Buscar ranks</label>
        <div className="relative">
          <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            id="store-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="checkout-input !pl-12 !pr-12"
            placeholder="Busque por nome ou benefício"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet" aria-label="Limpar busca">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {normalizedQuery ? `${filteredRanks.length} ${filteredRanks.length === 1 ? "rank encontrado" : "ranks encontrados"}` : "Pesquise pelo nome ou pela descrição do rank."}
        </p>
      </div>

      {filteredRanks.length > 0 ? (
        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-3">
          {filteredRanks.map((rank) => <RankCard key={rank.slug} rank={rank} detailed />)}
        </div>
      ) : (
        <div className="glass-panel mx-auto mt-10 max-w-2xl px-6 py-12 text-center">
          <SearchX size={32} className="mx-auto text-ultraviolet" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold uppercase text-ink">Nenhum rank encontrado</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Não encontramos ranks para “{deferredQuery.trim()}”. Tente outro nome ou benefício.</p>
          <button type="button" onClick={() => setQuery("")} className="button-secondary mt-6">Limpar busca</button>
        </div>
      )}
    </div>
  );
}
