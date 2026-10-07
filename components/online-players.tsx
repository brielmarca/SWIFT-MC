"use client";

import Link from "next/link";
import { RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { onlinePlayersSchema, type OnlinePlayer } from "@/lib/minecraft-data/types";
import { formatPlaytime } from "@/lib/player-format";
import { useServerStatus } from "./server-status-provider";
import { PlayerAvatar } from "./player-avatar";

function avatarProfile(player: OnlinePlayer) {
  return { username: player.username, uuid: player.uuid, avatarUrl: `/api/minecraft/avatar/${player.uuid}` };
}

export function OnlinePlayers() {
  const [state, setState] = useState<{ data: OnlinePlayer[] | null; loading: boolean }>({ data: null, loading: true });
  const [query, setQuery] = useState("");
  const active = useRef<AbortController | null>(null);
  const searchId = useId();
  const { data: status } = useServerStatus();

  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ data: null, loading: true });
    try {
      const response = await fetch("/api/players/online", {
        cache: "no-store",
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
      });
      if (!response.ok) throw new Error("Unavailable");
      const result = await response.json();
      const parsed = onlinePlayersSchema.safeParse(result.status === "available" ? result.data : null);
      if (!parsed.success) throw new Error("Invalid payload");
      if (!controller.signal.aborted) setState({ data: parsed.data, loading: false });
    } catch {
      if (!controller.signal.aborted) setState({ data: null, loading: false });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    return () => { clearTimeout(initial); active.current?.abort(); active.current = null; };
  }, [refresh]);

  const { data, loading } = state;
  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => (data ?? []).filter((player) => player.username.toLowerCase().includes(normalized)), [data, normalized]);
  const count = data ? data.length : null;
  const maxPlayers = status?.maxPlayers ?? null;

  return <div>
    <div className="glass-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="micro-label">Jogadores online agora</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums text-ink" role="status">
            {loading ? "…" : count !== null ? count : "—"}
            <span className="ml-1 text-xl font-bold text-muted">/ {maxPlayers !== null ? maxPlayers : "—"}</span>
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">{loading ? "Consultando a lista de jogadores online…" : count !== null ? "Lista informada pela API do servidor; capacidade informada pelo status do servidor." : "A lista de jogadores está indisponível agora. Nenhum jogador é estimado."}</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()} className="button-secondary disabled:cursor-wait disabled:opacity-60">
          <RefreshCw size={17} aria-hidden="true" className={loading ? "animate-spin" : ""} />{loading ? "Consultando…" : "Tentar novamente"}
        </button>
      </div>
      {data && data.length > 0 && <div className="mt-5">
        <label htmlFor={searchId} className="micro-label">Buscar jogador online</label>
        <div className="relative mt-2">
          <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Steve" className="checkout-input !pl-12" />
        </div>
        <p className="mt-3 text-sm text-muted" role="status">{visible.length === count ? `${count} ${count === 1 ? "jogador online" : "jogadores online"}` : `${visible.length} de ${count} jogadores online`}</p>
      </div>}
    </div>

    <div className="mt-6">
      {loading && <div className="glass-panel flex items-center gap-4 p-8"><RefreshCw size={20} aria-hidden="true" className="animate-spin text-ultraviolet" /><p className="text-sm text-muted">Carregando jogadores online…</p></div>}

      {!loading && !data && <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-ink">Lista de jogadores indisponível</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">A integração com a API do servidor pode não estar configurada ou o serviço está indisponível agora. Nenhum jogador é exibido sem dados reais.</p>
        <button type="button" onClick={() => void refresh()} className="button-primary mt-5">Tentar novamente</button>
      </div>}

      {!loading && data && data.length === 0 && <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-ink">Nenhum jogador online</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">O servidor informou 0 jogadores no momento. Confira novamente mais tarde ou entre no servidor para ser o primeiro.</p>
      </div>}

      {!loading && data && data.length > 0 && visible.length === 0 && <div className="glass-panel p-8 text-center">
        <h2 className="text-xl font-bold text-ink">Nenhum jogador corresponde à busca</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">Confira a escrita do username ou limpe a busca para ver todos os {count} jogadores online.</p>
        <button type="button" onClick={() => setQuery("")} className="button-secondary mt-5">Limpar busca</button>
      </div>}

      {!loading && data && visible.length > 0 && <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((player) => <li key={player.uuid} className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-card/80 px-4 py-3">
          <PlayerAvatar profile={avatarProfile(player)} size="sm" />
          <div className="min-w-0 flex-1">
            <Link href={`/player/${player.username}`} className="block truncate font-bold text-ink transition hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">{player.username}</Link>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {player.rank && <span className="rounded-md border border-violet/40 bg-violet/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ultraviolet">{player.rank}</span>}
              {player.playtimeSeconds !== null && <span className="text-xs tabular-nums text-muted">{formatPlaytime(player.playtimeSeconds)} de jogo</span>}
            </div>
          </div>
        </li>)}
      </ul>}

      {!loading && data && data.length > 0 && <p className="mt-6 text-xs leading-5 text-muted">Lista fornecida pela API do servidor SWIFT MC, com cache de até 10 segundos. Use “Tentar novamente” para atualizar.</p>}
    </div>
  </div>;
}
