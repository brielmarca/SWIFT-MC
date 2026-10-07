"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ServerStatus } from "@/lib/server-status";
import { serverInfo } from "@/data/server-info";

type StatusState = { data: ServerStatus | null; loading: boolean; refreshing: boolean; lastSuccess: string | null };
const StatusContext = createContext<(StatusState & { publicAddress: string; refresh: () => Promise<void> }) | null>(null);

export function ServerStatusProvider({ publicAddress, children }: { publicAddress: string; children: ReactNode }) {
  const [state, setState] = useState<StatusState>({ data: null, loading: true, refreshing: false, lastSuccess: null });
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setState((previous) => ({ ...previous, refreshing: true }));
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch("/api/server-status", { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("Status unavailable");
      const data: ServerStatus = await response.json();
      if (request.current === controller) setState({ data, loading: false, refreshing: false, lastSuccess: new Date().toISOString() });
    } catch {
      if (request.current === controller) setState((previous) => ({ ...previous, data: null, loading: false, refreshing: false }));
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => void refresh(), serverInfo.statusRefreshMs);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);
  return <StatusContext.Provider value={{ ...state, refresh, publicAddress: state.data?.publicAddress || publicAddress }}>{children}</StatusContext.Provider>;
}

export function useServerStatus() {
  const context = useContext(StatusContext);
  if (!context) throw new Error("useServerStatus requires ServerStatusProvider");
  return context;
}

export function ServerStatusChip() {
  const { data, loading } = useServerStatus();
  return (
    <div className="status-chip h-10 w-full max-w-xl overflow-hidden" role="status">
      <span className={`h-2 w-2 shrink-0 rounded-full ${data?.online ? "bg-ultraviolet" : "bg-muted"}`} aria-hidden="true" />
      <span className="truncate">{loading ? "Consultando servidor…" : !data ? "Status indisponível" : data.online ? `${data.players} / ${data.maxPlayers} jogadores online` : "Servidor offline ou indisponível"}</span>
      {data?.online && <span className="ml-auto hidden max-w-40 truncate text-ultraviolet sm:inline">{data.version}</span>}
    </div>
  );
}

export function ServerAddress() {
  const { publicAddress } = useServerStatus();
  return <span>{publicAddress}</span>;
}
