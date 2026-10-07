"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { playerStatsSchema, type PlayerStats } from "@/lib/minecraft-data/types";
import { formatPlayerNumber, formatPlayerTimestamp, formatPlaytime } from "@/lib/player-format";

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
  const fields = [
    ["Rank", data?.rank ?? "Indisponível"],
    ["Coins", formatPlayerNumber(data?.coins)],
    ["Tempo de jogo", formatPlaytime(data?.playtimeSeconds)],
    ["Primeira entrada", formatPlayerTimestamp(data?.firstJoin)],
    ["Visto por último", formatPlayerTimestamp(data?.lastSeen)],
    ["Presença", data?.online == null ? "Indisponível" : data.online ? "Online" : "Offline"],
    ["Abates", formatPlayerNumber(data?.kills)],
    ["Mortes", formatPlayerNumber(data?.deaths)],
  ];

  return <section className="glass-panel mt-8 p-5 sm:p-8" aria-labelledby="server-player-stats-title">
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="server-player-stats-title" className="text-2xl font-bold text-ink">No servidor SWIFT MC</h2><button type="button" disabled={loading} onClick={() => void refresh()} className="button-secondary disabled:cursor-wait disabled:opacity-60"><RefreshCw size={17} aria-hidden="true" className={loading ? "animate-spin" : ""} />{loading ? "Consultando…" : "Atualizar dados"}</button></div>
    <p className="mt-3 font-bold text-ultraviolet" role="status">{loading ? "Consultando dados do servidor…" : data ? "Dados informados pelo servidor" : "Dados do servidor indisponíveis"}</p>
    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{!loading && !data ? "A integração pode não estar configurada, o serviço pode estar indisponível ou este jogador ainda não possui dados no servidor. Nenhum valor é estimado." : "Os valores são fornecidos pela API do servidor e podem usar cache de até 15 segundos. Datas exibidas em UTC; campos não informados permanecem indisponíveis."}</p>
    <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-void/40 p-4"><dt className="micro-label">{label}</dt><dd className="mt-2 min-h-6 break-words text-sm tabular-nums text-ink">{loading ? "Consultando…" : value}</dd></div>)}</dl>
  </section>;
}
