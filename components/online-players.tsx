"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { onlinePlayersSchema, type OnlinePlayer } from "@/lib/minecraft-data/types";
import { formatPlaytime } from "@/lib/player-format";
import { useServerStatus } from "./server-status-provider";
import { NetworkPlayer } from "./network-player";
import { NetworkRefresh, NetworkStat, NetworkState } from "./network-ui";
import { CopyIpButton } from "./copy-ip-button";

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-ink">Na rede agora</h2>
        <NetworkRefresh loading={loading} onRefresh={() => void refresh()} />
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <NetworkStat label="Jogadores online" value={loading ? "…" : count ?? "—"} detail="Lista informada pelo servidor" />
        <NetworkStat label="Capacidade" value={maxPlayers ?? "—"} detail="Máximo informado pelo status da rede" />
      </dl>
      {data && data.length > 0 && <div className="network-panel p-5">
        <label htmlFor={searchId} className="micro-label">Buscar jogador online</label>
        <div className="relative mt-2">
          <Search size={19} aria-hidden="true" className="pointer-events-none absolute left-4 top-4 text-muted" />
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: Steve" className="checkout-input !pl-12" />
        </div>
        <p className="mt-3 text-sm text-muted" role="status">{visible.length === count ? `${count} ${count === 1 ? "jogador online" : "jogadores online"}` : `${visible.length} de ${count} jogadores online`}</p>
      </div>}
    </div>

    <div className="mt-6">
      {loading && <NetworkState kind="loading" title="Buscando jogadores" description="Consultando quem está conectado à SwiftMC agora." />}

      {!loading && !data && <NetworkState kind="error" title="Lista de jogadores indisponível" description="Não foi possível carregar os jogadores da rede. Tente atualizar em instantes.">
        <button type="button" onClick={() => void refresh()} className="network-action">Tentar novamente</button>
      </NetworkState>}

      {!loading && data && data.length === 0 && <NetworkState kind="empty" title="A próxima aventura pode ser sua" description="Nenhum jogador online no momento. Copie o IP e confira o status da rede para entrar na SwiftMC."><CopyIpButton /></NetworkState>}

      {!loading && data && data.length > 0 && visible.length === 0 && <NetworkState kind="empty" title="Nenhum jogador encontrado" description="Confira o username ou limpe a busca para ver todos os jogadores online.">
        <button type="button" onClick={() => setQuery("")} className="network-action">Limpar busca</button>
      </NetworkState>}

      {!loading && data && visible.length > 0 && <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((player) => <li key={player.uuid} className="network-panel min-w-0 p-5 transition hover:border-violet/40">
          <NetworkPlayer player={player} />
          {player.playtimeSeconds !== null && <p className="mt-4 border-t border-white/10 pt-3 text-xs tabular-nums text-muted">Tempo de jogo <span className="float-right font-bold text-ink">{formatPlaytime(player.playtimeSeconds)}</span></p>}
        </li>)}
      </ul>}

      {!loading && data && <p className="mt-6 text-xs leading-5 text-muted">Dados do servidor SwiftMC · Cache de até 10s. Use “Atualizar” para consultar novamente.</p>}
    </div>
  </div>;
}
