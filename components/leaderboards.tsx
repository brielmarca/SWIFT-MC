"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LEADERBOARD_ENTRIES,
  LEADERBOARD_CATEGORIES,
  leaderboardDataSchema,
  type LeaderboardCategory,
  type LeaderboardData,
  type LeaderboardEntry,
} from "@/lib/minecraft-data/types";
import { formatPlayerNumber, formatPlaytime } from "@/lib/player-format";
import { PlayerAvatar } from "./player-avatar";

const CATEGORY_LABELS: Record<LeaderboardCategory, string> = {
  playtime: "Tempo de jogo",
  kills: "Abates",
  coins: "Coins",
};

function formatValue(category: LeaderboardCategory, value: number): string {
  return category === "playtime" ? formatPlaytime(value) : formatPlayerNumber(value);
}

function avatarProfile(entry: LeaderboardEntry) {
  return { username: entry.username, uuid: entry.uuid, avatarUrl: `/api/minecraft/avatar/${entry.uuid}` };
}

function EntryIdentity({ entry, compact = false }: { entry: LeaderboardEntry; compact?: boolean }) {
  return <div className={compact ? "flex min-w-0 items-center gap-3" : "mt-4 flex min-w-0 items-center gap-3"}>
    <PlayerAvatar profile={avatarProfile(entry)} size={compact ? "sm" : "md"} />
    <div className="min-w-0">
      <Link href={`/player/${entry.username}`} className="block break-all font-bold text-ink transition hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">{entry.username}</Link>
      {entry.rank && <span className="mt-1 inline-block rounded-md border border-violet/40 bg-violet/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ultraviolet">{entry.rank}</span>}
    </div>
  </div>;
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
    if (next !== category) setCategory(next);
  };

  const { data, loading } = state;
  const entries = data?.entries ?? [];
  const podium = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return <div>
    <div className="glass-panel p-5 sm:p-6">
      <div role="tablist" aria-label="Categorias do ranking" className="flex flex-wrap gap-2">
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
            className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${category === item ? "border-violet bg-violet/15 text-ultraviolet" : "border-white/10 bg-card text-muted hover:text-ink"}`}
          >
            {CATEGORY_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-muted">{loading ? "Consultando o ranking do servidor…" : data ? `${entries.length} ${entries.length === 1 ? "jogador no ranking" : "jogadores no ranking"}` : "Ranking indisponível"}</p>
        <button type="button" disabled={loading} onClick={() => void refresh(category)} className="button-secondary disabled:cursor-wait disabled:opacity-60">
          <RefreshCw size={17} aria-hidden="true" className={loading ? "animate-spin" : ""} />{loading ? "Consultando…" : "Tentar novamente"}
        </button>
      </div>
    </div>

    <div id="leaderboard-panel" role="tabpanel" aria-labelledby={`leaderboard-tab-${category}`} className="mt-6">
      {loading && <div className="glass-panel flex items-center gap-4 p-8"><RefreshCw size={20} aria-hidden="true" className="animate-spin text-ultraviolet" /><p className="text-sm text-muted">Carregando os melhores jogadores de {CATEGORY_LABELS[category].toLowerCase()}…</p></div>}

      {!loading && !data && <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-ink">Ranking indisponível</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">A integração com a API do servidor pode não estar configurada ou o serviço está indisponível agora. Nenhum jogador ou valor é estimado.</p>
        <button type="button" onClick={() => void refresh(category)} className="button-primary mt-5">Tentar novamente</button>
      </div>}

      {!loading && data && entries.length === 0 && <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-ink">Nenhum jogador no ranking</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">A API do servidor ainda não retornou jogadores para esta categoria. O ranking é exibido somente com dados reais do servidor.</p>
      </div>}

      {!loading && data && entries.length > 0 && <div>
        <ol className="grid gap-4 sm:grid-cols-3">
          {podium.map((entry, index) => {
            const position = index + 1;
            return <li key={entry.uuid} className={`glass-panel min-w-0 p-5 ${position === 1 ? "border-violet/50" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold ${position === 1 ? "bg-violet text-ink" : "bg-white/10 text-ink"}`} aria-label={`${position}º lugar`}>#{position}</span>
                <span className="text-right text-sm font-extrabold tabular-nums text-ultraviolet">{formatValue(category, entry.value)}</span>
              </div>
              <EntryIdentity entry={entry} />
            </li>;
          })}
        </ol>
        {remaining.length > 0 && <ol start={4} className="mt-4 grid gap-2">
          {remaining.map((entry, index) => {
            const position = index + 4;
            return <li key={entry.uuid} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-card/80 px-4 py-3">
              <span className="w-9 shrink-0 text-sm font-bold tabular-nums text-muted" aria-label={`${position}º lugar`}>#{position}</span>
              <div className="min-w-0 flex-1"><EntryIdentity entry={entry} compact /></div>
              <span className="shrink-0 text-sm font-extrabold tabular-nums text-ultraviolet">{formatValue(category, entry.value)}</span>
            </li>;
          })}
        </ol>}
        <p className="mt-6 text-xs leading-5 text-muted">Dados fornecidos pela API do servidor SWIFT MC, com cache de até 15 segundos. Nenhum valor é estimado quando a integração está indisponível.</p>
      </div>}
    </div>
  </div>;
}
