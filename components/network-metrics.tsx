"use client";

import Link from "next/link";
import { useServerStatus } from "./server-status-provider";

export function NetworkMetrics() {
  const { data, loading } = useServerStatus();
  const placeholder = loading ? "…" : "—";
  const metrics = [
    { value: data?.online ? String(data.players) : placeholder, label: "Jogadores online", href: "/online" },
    { value: data?.online ? String(data.maxPlayers) : placeholder, label: "Capacidade", accent: true },
    { value: data?.online ? data.version : placeholder, label: "Versão do servidor" },
    { value: loading ? "Consultando" : !data ? "Indisponível" : data.online ? "Online" : "Offline", label: "Status da rede" },
  ];
  return (
    <section className="border-y border-white/[0.06] bg-black/25 py-6" aria-label="Métricas da rede">
      <dl className="site-container grid grid-cols-2 gap-y-8 md:grid-cols-4">
        {metrics.map((metric, index) => (
          <div key={metric.label} className={`min-w-0 text-center ${index > 0 ? "md:border-l md:border-white/[0.07]" : ""}`}>
            {metric.href ? (
              <Link href={metric.href} aria-label={`${metric.label}: ver jogadores online`} className="-mx-2 block rounded-lg px-2 transition hover:[&>dd]:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">
                <dd title={metric.value || undefined} className="h-10 truncate px-2 text-xl font-bold uppercase leading-10 tracking-tight sm:text-2xl text-ink">{metric.value}</dd>
                <dt className="micro-label mt-2">{metric.label}</dt>
              </Link>
            ) : (
              <>
                <dd title={metric.value || undefined} className={`h-10 truncate px-2 text-xl font-bold uppercase leading-10 tracking-tight sm:text-2xl ${metric.accent ? "text-ultraviolet" : "text-ink"}`}>{metric.value}</dd>
                <dt className="micro-label mt-2">{metric.label}</dt>
              </>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
