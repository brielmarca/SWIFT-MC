"use client";

import { useServerStatus } from "@/components/server-status-provider";
import { serverInfo } from "@/data/server-info";

export function ServerInfoVersion() {
  const { data, loading } = useServerStatus();
  return (
    <dd className="mt-2 min-h-7 break-words text-lg font-bold text-ink">
      {loading ? "Consultando…" : data?.version || serverInfo.defaultHost}
    </dd>
  );
}