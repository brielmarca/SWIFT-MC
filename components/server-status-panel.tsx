"use client";

import { RefreshCw } from "lucide-react";
import { serverInfo } from "@/data/server-info";
import { CopyIpButton } from "./copy-ip-button";
import { ServerStatusChip, useServerStatus } from "./server-status-provider";

export function ServerStatusPanel({ detailed = false }: { detailed?: boolean }) {
  const { data, loading, refreshing, lastSuccess, refresh, publicAddress } = useServerStatus();
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
      {detailed && <button type="button" className="button-secondary disabled:cursor-wait disabled:opacity-60" disabled={refreshing || loading} onClick={() => void refresh()}>
        <RefreshCw size={18} aria-hidden="true" className={refreshing ? "animate-spin" : ""} /> {refreshing || loading ? "Atualizando…" : "Atualizar status"}
      </button>}
    </div>
    {detailed && <div className="mt-6 border-t border-white/10 pt-5 text-sm leading-6 text-muted">
      <p role="status">Última atualização bem-sucedida: {lastSuccess ? <time dateTime={lastSuccess}>{new Date(lastSuccess).toLocaleString("pt-BR")}</time> : "nenhuma consulta concluída"}.</p>
      <p className="mt-2">Atualização automática a cada {serverInfo.statusRefreshMs / 1000} segundos. As respostas podem usar cache de até 15 segundos. O horário indica a última resposta recebida da API, mesmo quando o servidor está offline.</p>
    </div>}
    <p className="mt-4 min-h-12 text-sm leading-6 text-muted">{loading ? "Consultando o servidor. O endereço já pode ser copiado." : !data ? "Não foi possível consultar o status agora. Tente atualizar novamente ou consulte a comunidade no Discord." : !data.online ? "O servidor está offline ou não respondeu à consulta. Aguarde e tente novamente; o endereço continua disponível para copiar." : "Servidor respondendo. Confira a versão acima antes de conectar."}</p>
  </section>;
}
