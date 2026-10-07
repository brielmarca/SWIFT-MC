"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { isJavaUsername, type ProfileResult } from "@/lib/minecraft-profile";
import { PlayerAvatar } from "./player-avatar";

export function MinecraftProfileLookup({ username }: { username: string }) {
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);

  async function lookup() {
    if (!isJavaUsername(username)) { setResult({ status: "invalid" }); return; }
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/minecraft/profile?username=${encodeURIComponent(username)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(6000)]), cache: "no-store",
      });
      const data: ProfileResult = await response.json();
      if (!controller.signal.aborted) setResult(response.ok || response.status === 400 ? data : { status: "unavailable" });
    } catch {
      if (!controller.signal.aborted) setResult({ status: "unavailable" });
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <div className="mt-3">
    <button type="button" onClick={() => void lookup()} disabled={loading} className="button-secondary disabled:cursor-wait disabled:opacity-60">{loading ? "Consultando perfil…" : "Consultar perfil Java"}</button>
    <div className="mt-3 min-h-6 text-sm leading-6 text-muted" role="status" aria-live="polite">
      {loading && "Buscando perfil público do Minecraft…"}
      {result?.status === "invalid" && "Nome inválido. Use de 3 a 16 letras, números ou sublinhado (_)."}
      {result?.status === "not_found" && "Perfil Java não encontrado. Confira o nome e tente novamente."}
      {result?.status === "unavailable" && "Consulta indisponível no momento. Seus dados continuam preenchidos; tente novamente."}
      {result?.status === "found" && <div className="flex items-start gap-4 rounded-xl border border-violet/25 bg-violet/5 p-4">
        <PlayerAvatar key={result.profile.uuid} profile={result.profile} />
        <div className="min-w-0"><Link href={`/player/${result.profile.username}`} prefetch={false} className="inline-flex min-h-11 items-center rounded font-bold text-ink hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet" aria-label={`Ver perfil público de ${result.profile.username}`}>{result.profile.username}</Link><p className="mt-1 text-xs">UUID</p><p className="break-all font-mono text-xs">{result.profile.uuid}</p></div>
      </div>}
    </div>
  </div>;
}
