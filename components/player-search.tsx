"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, RefreshCw, Search, Trash2, UserRound } from "lucide-react";
import { useRef, useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { NetworkState } from "./network-ui";
import { isJavaUsername } from "@/lib/minecraft-profile";
import { addRecentPlayer, parseRecentPlayers, RECENT_PLAYERS_KEY } from "@/lib/recent-players";

const RECENTS_EVENT = "swift-mc-recent-players-change";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(RECENTS_EVENT, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(RECENTS_EVENT, callback); };
}
function snapshot() {
  try { return window.localStorage.getItem(RECENT_PLAYERS_KEY) || "[]"; } catch { return "[]"; }
}

export function PlayerSearch() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const recent = parseRecentPlayers(useSyncExternalStore(subscribe, snapshot, () => "[]"));

  function saveRecent(name: string) {
    try {
      window.localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(addRecentPlayer(parseRecentPlayers(snapshot()), name)));
      window.dispatchEvent(new Event(RECENTS_EVENT));
    } catch { /* Search remains usable when browser storage is blocked. */ }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = username.trim();
    if (!isJavaUsername(name)) {
      setError("Use de 3 a 16 caracteres: letras, números ou sublinhado (_). Sem espaços ou acentos.");
      input.current?.focus();
      return;
    }
    setError("");
    saveRecent(name);
    startTransition(() => router.push(`/player/${encodeURIComponent(name)}`));
  }

  function clearRecent() {
    try {
      window.localStorage.removeItem(RECENT_PLAYERS_KEY);
      window.dispatchEvent(new Event(RECENTS_EVENT));
      setStorageError("");
    } catch { setStorageError("Não foi possível limpar o histórico. Verifique as permissões de armazenamento do navegador."); }
  }

  return <div className="space-y-6">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <form onSubmit={search} noValidate aria-busy={pending} className="network-panel min-w-0 border-violet/25 bg-gradient-to-br from-violet/10 to-transparent p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3"><span className="icon-well"><Search size={22} aria-hidden="true" /></span><div><p className="micro-label">Identidade Minecraft</p><h2 className="mt-1 text-lg font-extrabold text-ink">Quem você procura?</h2></div></div>
      <label htmlFor="player-search" className="text-sm font-bold text-ink">Username do Minecraft Java</label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input ref={input} id="player-search" name="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} required readOnly={pending} className="checkout-input min-w-0 flex-1 !border-violet/30 !font-mono" placeholder="Ex.: Steve" aria-invalid={Boolean(error)} aria-describedby="player-search-help player-search-error" />
        <button type="submit" disabled={pending} className="button-primary shrink-0 disabled:cursor-wait disabled:opacity-60">{pending ? <RefreshCw size={18} aria-hidden="true" className="animate-spin" /> : <Search size={18} aria-hidden="true" />}{pending ? "Buscando…" : "Ver perfil"}</button>
      </div>
      <p id="player-search-help" className="mt-3 text-xs leading-5 text-muted">Use o nome atual: 3 a 16 letras, números ou sublinhado (_).</p>
      <p id="player-search-error" className={error ? "mt-4 rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-sm leading-6 text-red-300" : "sr-only"} role="alert">{error}</p>
    </form>
    <aside className="network-panel p-5 sm:p-6" aria-labelledby="player-search-about">
      <h2 id="player-search-about" className="text-sm font-bold text-ink">Por trás do username</h2>
      <ul className="mt-4 space-y-3 text-sm leading-6 text-muted"><li><span className="font-bold text-ink">Identidade</span> · Nome, avatar e skin da conta Java.</li><li><span className="font-bold text-ink">Na SwiftMC</span> · Rank, presença, tempo de jogo e estatísticas, quando disponíveis.</li></ul>
      <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-muted">Ter uma conta Minecraft não confirma participação na rede.</p>
    </aside>
    </div>
    {pending && <NetworkState kind="loading" title="Buscando perfil" description="Consultando a identidade Minecraft. O perfil será aberto assim que a consulta terminar." />}
    <section className="network-panel p-5 sm:p-6" aria-labelledby="recent-players-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-players-title" className="text-sm font-bold text-ink">Buscas recentes</h2>
        {recent.length > 0 && <button type="button" onClick={clearRecent} className="inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-bold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><Trash2 size={16} aria-hidden="true" /> Limpar histórico</button>}
      </div>
      {recent.length ? <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{recent.map((name) => <li key={name.toLowerCase()}><Link href={`/player/${name}`} prefetch={false} onClick={() => saveRecent(name)} className="network-action w-full justify-start"><UserRound size={16} aria-hidden="true" className="shrink-0 text-ultraviolet" /><span className="min-w-0 break-all">{name}</span><ArrowUpRight size={14} aria-hidden="true" className="ml-auto shrink-0 text-muted" /></Link></li>)}</ul> : <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed border-violet/20 bg-void/30 p-4"><UserRound size={20} aria-hidden="true" className="shrink-0 text-ultraviolet" /><p className="text-sm leading-6 text-muted">Seu próximo encontro começa com um nome. As buscas aparecerão aqui para você revisitar os perfis.</p></div>}
      <p className="mt-4 text-xs leading-5 text-muted">Até 8 buscas ficam salvas apenas neste navegador quando o armazenamento local está disponível.</p>
      <p role="status" className="mt-2 text-sm text-muted">{storageError}</p>
    </section>
  </div>;
}
