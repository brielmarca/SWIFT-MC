"use client";

import { useServerStatus } from "@/components/server-status-provider";

export function ServerInfoStatus() {
  const { data, loading } = useServerStatus();
  return (
    <dd className="mt-2 min-h-7 text-lg font-bold text-ink">
      {loading ? "Consultando…" : !data ? "Indisponível" : data.online ? "Online" : "Offline"}
    </dd>
  );
}