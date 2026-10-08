"use client";

import { Copy, Link as LinkIcon, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function PlayerProfileActions({ uuid, username }: { uuid: string; username: string }) {
  const [feedback, setFeedback] = useState("");
  const [manualCopy, setManualCopy] = useState("");

  async function copy(kind: "uuid" | "url") {
    const value = kind === "uuid" ? uuid : new URL(`/player/${encodeURIComponent(username)}`, window.location.origin).href;
    setFeedback("");
    setManualCopy("");
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(kind === "uuid" ? "UUID copiado." : "Link do perfil copiado. Pronto para compartilhar!");
    } catch {
      setFeedback("Não foi possível copiar automaticamente. Selecione e copie o texto abaixo.");
      setManualCopy(value);
    }
  }

  return <div className="mt-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"><button type="button" onClick={() => void copy("url")} className="network-action border-violet/40 bg-violet/10 text-ultraviolet"><LinkIcon size={17} aria-hidden="true" /> Copiar link do perfil</button><button type="button" onClick={() => void copy("uuid")} className="network-action"><Copy size={17} aria-hidden="true" /> Copiar UUID</button></div>
    <p className={feedback ? "mt-3 rounded-lg border border-violet/20 bg-violet/5 p-3 text-sm leading-6 text-muted" : "sr-only"} role="status" aria-live="polite">{feedback}</p>
    {manualCopy && <div className="mt-2"><label htmlFor="manual-profile-copy" className="micro-label">Texto para copiar</label><input id="manual-profile-copy" readOnly value={manualCopy} onFocus={(event) => event.currentTarget.select()} className="checkout-input mt-2 font-mono" /></div>}
  </div>;
}

export function RetryPlayerProfile() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="network-action disabled:cursor-wait disabled:opacity-60"><RefreshCw size={17} aria-hidden="true" className={pending ? "animate-spin" : ""} />{pending ? "Consultando…" : "Tentar novamente"}</button>;
}
