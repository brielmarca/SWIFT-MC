"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
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
    router.push(`/player/${encodeURIComponent(name)}`);
  }

  function clearRecent() {
    try {
      window.localStorage.removeItem(RECENT_PLAYERS_KEY);
      window.dispatchEvent(new Event(RECENTS_EVENT));
      setStorageError("");
    } catch { setStorageError("Não foi possível limpar o histórico. Verifique as permissões de armazenamento do navegador."); }
  }

  return <div className="max-w-3xl space-y-6">
    <form onSubmit={search} noValidate className="glass-panel p-5 sm:p-8">
      <label htmlFor="player-search" className="text-sm font-bold text-ink">Nome no Minecraft Java</label>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input ref={input} id="player-search" name="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={64} required className="checkout-input min-w-0 flex-1" placeholder="Nome do jogador" aria-invalid={Boolean(error)} aria-describedby="player-search-help player-search-error" />
        <button type="submit" className="button-primary shrink-0"><Search size={18} aria-hidden="true" /> Buscar jogador</button>
      </div>
      <p id="player-search-help" className="mt-3 text-sm leading-6 text-muted">Busque pelo nome atual de uma conta Java. O perfil público não indica se a pessoa joga no SWIFT MC.</p>
      <p id="player-search-error" className="mt-2 text-sm text-red-300" role="alert">{error}</p>
    </form>
    <section className="glass-panel p-5 sm:p-8" aria-labelledby="recent-players-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-players-title" className="text-xl font-bold text-ink">Buscas recentes</h2>
        {recent.length > 0 && <button type="button" onClick={clearRecent} className="inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-bold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"><Trash2 size={16} aria-hidden="true" /> Limpar histórico</button>}
      </div>
      {recent.length ? <ul className="mt-4 flex flex-wrap gap-2">{recent.map((name) => <li key={name.toLowerCase()}><Link href={`/player/${name}`} prefetch={false} onClick={() => saveRecent(name)} className="button-secondary !px-4 !normal-case !tracking-normal">{name}</Link></li>)}</ul> : <p className="mt-4 text-sm leading-6 text-muted">Nenhuma busca recente. Digite um nome acima para encontrar um perfil público.</p>}
      <p className="mt-4 text-xs leading-5 text-muted">Até 8 buscas ficam salvas apenas neste navegador quando o armazenamento local está disponível.</p>
      <p role="status" className="mt-2 text-sm text-muted">{storageError}</p>
    </section>
  </div>;
}
