import { Server } from "lucide-react";
import Link from "next/link";
import { CopyIpButton } from "./copy-ip-button";
import { ServerAddress, ServerStatusChip } from "./server-status-provider";

export function PlayServerCard({ showStatus = false }: { showStatus?: boolean }) {
  return <section className="glass-panel w-full p-4 sm:p-6" aria-label="Conectar ao SwiftMC">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4"><span className="icon-well shrink-0"><Server size={22} aria-hidden="true" /></span><div className="min-w-0"><span className="micro-label">Minecraft Java · Endereço do servidor</span><p className="break-all font-mono text-lg font-bold tracking-wide text-ink"><ServerAddress /></p><p className="mt-1 text-xs leading-5 text-muted">Multijogador → Adicionar servidor → Cole o endereço.</p></div></div>
      <CopyIpButton play />
    </div>
    {showStatus && <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5"><ServerStatusChip /><Link href="/status" className="button-secondary">Ver status completo</Link></div>}
  </section>;
}
