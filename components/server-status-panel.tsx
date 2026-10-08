"use client";

import { serverInfo } from "@/data/server-info";
import { CopyIpButton } from "./copy-ip-button";
import { ServerStatusChip, useServerStatus } from "./server-status-provider";
import { NetworkRefresh, NetworkStat, NetworkState } from "./network-ui";

export function ServerStatusPanel({ detailed = false }: { detailed?: boolean }) {
  const { data, loading, refreshing, lastSuccess, refresh, publicAddress } = useServerStatus();
  if (detailed) return <section aria-label="Status do servidor" className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-ink">Visão da rede</h2>
      <NetworkRefresh loading={loading || refreshing} onRefresh={() => void refresh()} />
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <NetworkStat label="Servidor" value={<span className="inline-flex items-center gap-2"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${data?.online ? "bg-ultraviolet" : "bg-muted"}`} />{loading ? "…" : !data ? "Indisponível" : data.online ? "Online" : "Offline"}</span>} detail="Disponibilidade da conexão" />
      <NetworkStat label="Jogadores online" value={loading ? "…" : data?.online ? data.players : "—"} detail="Conectados neste momento" />
      <NetworkStat label="Capacidade" value={loading ? "…" : data?.online ? data.maxPlayers : "—"} detail="Máximo de jogadores" />
      <NetworkStat label="Versão" value={loading ? "…" : data?.version || "—"} detail={serverInfo.edition} />
    </dl>
    <div className="network-panel flex flex-col gap-5 border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0"><p className="micro-label">Seu próximo destino · {serverInfo.edition}</p><p className="mt-2 break-all font-mono text-xl font-bold text-ink sm:text-2xl">{publicAddress}</p><p className="mt-2 text-sm text-muted">Adicione este endereço à sua lista de servidores.</p></div>
      <div className="shrink-0"><CopyIpButton /></div>
    </div>
    {loading ? <NetworkState kind="loading" title="Consultando o servidor" description="Buscando disponibilidade e detalhes de conexão. Você já pode copiar o IP." />
      : !data ? <NetworkState kind="error" title="Status indisponível" description="Não foi possível consultar a rede agora. Tente atualizar em instantes." />
      : !data.online ? <NetworkState kind="empty" title="Servidor offline ou sem resposta" description="A rede não respondeu à consulta. Confira os avisos da comunidade ou tente novamente em instantes." />
      : null}
    <div className="text-xs leading-5 text-muted">
      <p role="status">Última resposta: {lastSuccess ? <time dateTime={lastSuccess}>{new Date(lastSuccess).toLocaleString("pt-BR")}</time> : "aguardando consulta"}.</p>
      <p className="mt-1">Atualização automática a cada {serverInfo.statusRefreshMs / 1000}s · Cache de até 15s. O horário inclui respostas de servidor offline.</p>
    </div>
  </section>;
  return <section className="glass-panel p-5 sm:p-8" aria-label="Status do servidor">
    <ServerStatusChip />
    <dl className="mt-6 grid gap-6 sm:grid-cols-2">
      <div className="min-w-0 sm:col-span-2">
        <dt className="micro-label">Endereço público · {serverInfo.edition}</dt>
        <dd className="mt-2 break-all font-mono text-xl font-bold text-ink">{publicAddress}</dd>
      </div>
      <div><dt className="micro-label">Jogadores / capacidade</dt><dd className="mt-2 min-h-7 text-xl font-bold tabular-nums text-ultraviolet">{loading ? "Consultando…" : data?.online ? `${data.players} / ${data.maxPlayers}` : "Indisponível"}</dd></div>
      <div className="min-w-0"><dt className="micro-label">Versão informada</dt><dd className="mt-2 min-h-7 break-words text-lg font-bold text-ink">{loading ? "Consultando…" : data?.version || "Indisponível"}</dd></div>
    </dl>
    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <CopyIpButton />
    </div>
    <p className="mt-4 min-h-12 text-sm leading-6 text-muted">{loading ? "Consultando o servidor. O endereço já pode ser copiado." : !data ? "Não foi possível consultar o status agora. Tente atualizar novamente ou consulte a comunidade no Discord." : !data.online ? "O servidor está offline ou não respondeu à consulta. Aguarde e tente novamente; o endereço continua disponível para copiar." : "Servidor respondendo. Confira a versão acima antes de conectar."}</p>
  </section>;
}
