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
          <div key={metric.label} className={`flex min-w-0 flex-col text-center ${index > 0 ? "md:border-l md:border-white/10" : ""}`}>
            <dt className="micro-label order-2 mt-2">{metric.label}</dt>
            <dd title={metric.value || undefined} className={`order-1 min-h-11 truncate px-2 text-xl font-bold uppercase leading-10 tracking-tight sm:text-2xl ${metric.accent ? "text-ultraviolet" : "text-ink"}`}>
              {metric.href ? <Link href={metric.href} aria-label={`${metric.label}: ver jogadores online`} className="block min-h-11 rounded-lg hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ultraviolet">{metric.value}</Link> : metric.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
