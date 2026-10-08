"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playerStatsSchema, type PlayerStats } from "@/lib/minecraft-data/types";
import { formatPlayerNumber, formatPlayerTimestamp, formatPlaytime } from "@/lib/player-format";
import { NetworkRefresh, NetworkStat, NetworkState } from "./network-ui";
import { NetworkPlayerRank } from "./network-player";

export function PlayerServerStats({ username, uuid }: { username: string; uuid: string }) {
  const [state, setState] = useState<{ data: PlayerStats | null; loading: boolean }>({ data: null, loading: true });
  const active = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState({ data: null, loading: true });
    try {
      const response = await fetch(`/api/player/${encodeURIComponent(username)}/stats`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
      if (!response.ok) throw new Error("Unavailable");
      const result = await response.json();
      const parsed = playerStatsSchema.safeParse(result.status === "available" ? result.data : null);
      if (!parsed.success || parsed.data.uuid !== uuid || parsed.data.username.toLowerCase() !== username.toLowerCase()) throw new Error("Invalid stats");
      if (!controller.signal.aborted) setState({ data: parsed.data, loading: false });
    } catch {
      if (!controller.signal.aborted) setState({ data: null, loading: false });
    } finally { if (active.current === controller) active.current = null; }
  }, [username, uuid]);

  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    return () => { clearTimeout(initial); active.current?.abort(); active.current = null; };
  }, [refresh]);

  const { data, loading } = state;
  return <section className="mt-8 space-y-6" aria-labelledby="server-player-stats-title">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="micro-label">Trajetória na rede</p><h2 id="server-player-stats-title" className="mt-1 text-lg font-extrabold text-ink">Na SwiftMC</h2></div>
      <NetworkRefresh loading={loading} onRefresh={() => void refresh()} />
    </div>
    {loading ? <NetworkState kind="loading" title="Consultando a trajetória" description="Buscando presença e estatísticas informadas pelo servidor." />
      : !data ? <NetworkState kind="error" title="Dados do servidor indisponíveis" description="Este jogador pode ainda não ter dados na SwiftMC, ou a consulta está indisponível. A identidade Minecraft continua disponível acima.">
        <button type="button" onClick={() => void refresh()} className="network-action">Tentar novamente</button>
      </NetworkState>
      : <>
        <section aria-labelledby="player-network-identity">
          <h3 id="player-network-identity" className="mb-3 text-sm font-bold text-ink">Identidade na SwiftMC</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <NetworkStat label="Rank" value={data.rank ? <NetworkPlayerRank rank={data.rank} /> : <span className="text-base text-muted">Indisponível</span>} detail="Rank informado pelo servidor" />
            <NetworkStat label="Presença" value={data.online === null ? <span className="text-base text-muted">Indisponível</span> : <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${data.online ? "bg-ultraviolet" : "bg-muted"}`} />{data.online ? "Online" : "Offline"}</span>} detail="Estado na última consulta" />
          </dl>
        </section>
        <section aria-labelledby="player-gameplay">
          <h3 id="player-gameplay" className="mb-3 text-sm font-bold text-ink">Em jogo</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Tempo de jogo", raw: data.playtimeSeconds, value: formatPlaytime(data.playtimeSeconds) },
              { label: "Kills · Abates", raw: data.kills, value: formatPlayerNumber(data.kills) },
              { label: "Mortes", raw: data.deaths, value: formatPlayerNumber(data.deaths) },
              { label: "Coins", raw: data.coins, value: formatPlayerNumber(data.coins) },
            ].map(({ label, raw, value }) => <NetworkStat key={label} label={label} value={raw === null ? <span className="text-base text-muted">Indisponível</span> : value} />)}
          </dl>
        </section>
        <section aria-labelledby="player-activity">
          <h3 id="player-activity" className="mb-3 text-sm font-bold text-ink">Atividade</h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Primeira entrada", value: data.firstJoin },
              { label: "Visto por último", value: data.lastSeen },
            ].map(({ label, value }) => <NetworkStat key={label} label={label} value={value ? <time dateTime={value} className="block text-base leading-6">{formatPlayerTimestamp(value)}</time> : <span className="text-base text-muted">Indisponível</span>} />)}
          </dl>
        </section>
        <p className="text-xs leading-5 text-muted">Dados do servidor SwiftMC · Cache de até 15s · Datas em UTC. “Indisponível” indica um campo não informado; zero é um valor registrado.</p>
      </>}
  </section>;
}
