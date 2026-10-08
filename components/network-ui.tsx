import { Radio, RefreshCw, Unplug } from "lucide-react";
import type { ReactNode } from "react";

export function NetworkStat({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <div className="network-panel min-w-0 p-5">
    <dt className="micro-label">{label}</dt>
    <dd className="mt-3 break-words text-2xl font-extrabold tracking-tight tabular-nums text-ink">{value}</dd>
    {detail && <dd className="mt-2 text-xs leading-5 text-muted">{detail}</dd>}
  </div>;
}

export function NetworkRefresh({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
  return <button type="button" disabled={loading} onClick={onRefresh} className="network-action disabled:cursor-wait disabled:opacity-60">
    <RefreshCw size={16} aria-hidden="true" className={loading ? "animate-spin" : ""} />{loading ? "Atualizando…" : "Atualizar"}
  </button>;
}

export function NetworkState({ kind, title, description, children }: { kind: "loading" | "empty" | "error"; title: string; description: string; children?: ReactNode }) {
  const Icon = kind === "loading" ? RefreshCw : kind === "error" ? Unplug : Radio;
  return <div className="network-panel flex min-h-60 flex-col items-center justify-center px-5 py-10 text-center">
    <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl border border-violet/25 bg-violet/10 text-ultraviolet">
      <Icon size={22} aria-hidden="true" className={kind === "loading" ? "animate-spin" : ""} />
    </div>
    <div role="status">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
    </div>
    {children && <div className="mt-5">{children}</div>}
  </div>;
}
