"use client";

import { Crown, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LEADERBOARD_ENTRIES,
  LEADERBOARD_CATEGORIES,
  leaderboardDataSchema,
  type LeaderboardCategory,
  type LeaderboardData,
} from "@/lib/minecraft-data/types";
import { formatPlayerNumber, formatPlaytime } from "@/lib/player-format";
import { NetworkPlayer } from "./network-player";
import { NetworkRefresh, NetworkStat, NetworkState } from "./network-ui";

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  playtime: "Playtime",
  kills: "Kills",
  coins: "Coins",
};

function formatValue(category: LeaderboardCategory, value: number): string {
  return category === "playtime" ? formatPlaytime(value) : formatPlayerNumber(value);
}

export function Leaderboards() {
  const [category, setCategory] = useState<LeaderboardCategory>("playtime");
  const [state, setState] = useState<{ data: LeaderboardData | null; loading: boolean }>({ data: null, loading: true });
  const active = useRef<AbortController | null>(null);

  const refresh = useCallback(async (next: LeaderboardCategory) => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ data: null, loading: true });
    try {
      const response = await fetch(`/api/leaderboards?category=${next}&limit=${DEFAULT_LEADERBOARD_ENTRIES}`, {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok) throw new Error("Unavailable");
      const result = await response.json();
      const parsed = leaderboardDataSchema.safeParse(result.status === "available" ? result.data : null);
      if (!parsed.success || parsed.data.category !== next) throw new Error("Invalid payload");
      if (!controller.signal.aborted) setState({ data: parsed.data, loading: false });
    } catch {
      if (!controller.signal.aborted) setState({ data: null, loading: false });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(category), 0);
    return () => { clearTimeout(initial); active.current?.abort(); active.current = null; };
  }, [category, refresh]);

  const selectCategory = (next: LeaderboardCategory) => {
    if (next !== category) {
      setState({ data: null, loading: true });
      setCategory(next);
    }
  };

  const { data, loading } = state;
  const entries = data?.entries ?? [];
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return <div>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Destaques da comunidade</h2>
        <NetworkRefresh loading={loading} onRefresh={() => void refresh(category)} />
      </div>
      <div role="tablist" aria-label="Categorias do ranking" className="grid grid-cols-3 gap-2">
        {LEADERBOARD_CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`leaderboard-tab-${item}`}
            aria-selected={category === item}
            aria-controls="leaderboard-panel"
            tabIndex={category === item ? 0 : -1}
            onClick={() => selectCategory(item)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const index = LEADERBOARD_CATEGORIES.indexOf(category);
              const delta = event.key === "ArrowRight" ? 1 : -1;
              const next = LEADERBOARD_CATEGORIES[(index + delta + LEADERBOARD_CATEGORIES.length) % LEADERBOARD_CATEGORIES.length];
              selectCategory(next);
              document.getElementById(`leaderboard-tab-${next}`)?.focus();
            }}
            className={`min-h-12 rounded-lg border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${category === item ? "border-violet/60 bg-violet/15 text-ultraviolet" : "border-white/10 bg-card/80 text-muted hover:border-violet/30 hover:text-ink"}`}
          >
            {CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <NetworkStat label="Categoria" value={CATEGORY_LABELS[category]} detail={category === "playtime" ? "Tempo total de jogo" : category === "kills" ? "Abates registrados" : "Coins registrados"} />
        <NetworkStat label="Jogadores no ranking" value={loading ? "…" : data ? entries.length : "—"} detail={`Até ${DEFAULT_LEADERBOARD_ENTRIES} jogadores por categoria`} />
      </dl>
    </div>

    <div id="leaderboard-panel" role="tabpanel" aria-labelledby={`leaderboard-tab-${category}`} tabIndex={0} className="mt-6 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
      {loading && <NetworkState kind="loading" title="Buscando os destaques" description={`Carregando o ranking de ${CATEGORY_LABELS[category]}.`} />}

      {!loading && !data && <NetworkState kind="error" title="Ranking indisponível" description="Não foi possível carregar esta categoria. Tente atualizar em instantes ou explore outro ranking.">
        <button type="button" onClick={() => void refresh(category)} className="network-action">Tentar novamente</button>
      </NetworkState>}

      {!loading && data && entries.length === 0 && <NetworkState kind="empty" title="Uma história ainda por escrever" description="Nenhum jogador no ranking desta categoria por enquanto. Os destaques aparecem aqui assim que o servidor informar os resultados." />}

      {!loading && data && entries.length > 0 && <div>
        <ol aria-label="Top 3" className="grid gap-3 md:grid-cols-3">
          {podium.map((entry, index) => {
            const position = index + 1;
            return <li key={entry.uuid} className={`network-panel relative min-w-0 overflow-hidden p-5 ${position === 1 ? "border-violet/50 bg-gradient-to-br from-violet/20 via-card to-card" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${position === 1 ? "bg-violet text-ink" : "bg-white/10 text-ink"}`} aria-label={`${position}º lugar`}>#{position}</span>
                {position === 1 ? <Crown size={22} aria-hidden="true" className="text-ultraviolet" /> : <Trophy size={20} aria-hidden="true" className="text-muted" />}
              </div>
              <div className="mt-5"><NetworkPlayer player={entry} /></div>
              <div className="mt-5 border-t border-white/10 pt-4"><p className="micro-label">{CATEGORY_LABELS[category]}</p><p className="mt-2 break-words text-2xl font-extrabold tabular-nums text-ultraviolet">{formatValue(category, entry.value)}</p></div>
            </li>;
          })}
        </ol>
        {remaining.length > 0 && <><div aria-hidden="true" className="mt-6 flex justify-between px-4 pb-3 text-[11px] font-bold uppercase tracking-wider text-muted"><span>Posição / Jogador</span><span>{CATEGORY_LABELS[category]}</span></div><ol start={4} className="network-panel divide-y divide-white/10 overflow-hidden">
          {remaining.map((entry, index) => {
            const position = index + 4;
            return <li key={entry.uuid} className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 px-4 py-4 even:bg-white/[0.02] sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
              <span className="w-9 shrink-0 text-sm font-bold tabular-nums text-muted" aria-label={`${position}º lugar`}>#{position}</span>
              <NetworkPlayer player={entry} compact />
              <span className="col-start-2 break-words text-sm font-extrabold tabular-nums text-ultraviolet sm:col-start-3 sm:text-right">{formatValue(category, entry.value)}<span className="sr-only"> {CATEGORY_LABELS[category]}</span></span>
            </li>;
          })}
        </ol></>}
        <p className="mt-6 text-xs leading-5 text-muted">Dados do servidor SwiftMC · Cache de até 15s. Classificação por {CATEGORY_LABELS[category].toLowerCase()}.</p>
      </div>}
    </div>
  </div>;
}
