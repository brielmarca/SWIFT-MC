"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import { ranks } from "@/data/ranks";
import { RankCard } from "./rank-card";
import { ContentEmpty } from "./content/content-empty";

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
      <div>
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-2xl font-extrabold uppercase text-ink tracking-wide">VIPs</h2>
          <div className="relative w-full max-w-md">
            <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="store-search"
              aria-label="Busque por nome ou benefício"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              className="checkout-input !pl-12 !pr-12"
              placeholder="Busque por nome ou benefício"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
                aria-label="Limpar busca"
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <p className="mb-6 text-xs text-muted" aria-live="polite">
          {normalizedQuery
            ? `${filteredRanks.length} ${filteredRanks.length === 1 ? "rank encontrado" : "ranks encontrados"}`
            : "Pesquise pelo nome ou pela descrição do rank."}
        </p>

        {filteredRanks.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {filteredRanks.map((rank) => (
              <RankCard key={rank.slug} rank={rank} />
            ))}
          </div>
        ) : (
          <ContentEmpty title="Nenhum rank encontrado" description={`Não encontramos ranks para "${deferredQuery.trim()}". Tente outro nome ou benefício.`}>
            <button type="button" onClick={() => setQuery("")} className="network-action">
              Limpar busca
            </button>
          </ContentEmpty>
        )}
      </div>
    </div>
  );
}
