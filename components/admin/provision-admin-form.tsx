"use client";
import { useState, type FormEvent } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export function ProvisionAdminForm() {
  const [discordSubject, setDiscordSubject] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setMsg({ tone: "err", text: "Recarregue a página para continuar com segurança." }); return; }
    if (!/^\d{5,32}$/.test(discordSubject.trim())) { setMsg({ tone: "err", text: "Informe um Discord ID numérico válido (provider subject)." }); return; }
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/provisioned-admins", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ discordSubject: discordSubject.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "failed");
      setMsg({ tone: "ok", text: "Discord ID adicionado à allowlist. A conta vira admin ao entrar com Discord." });
      setDiscordSubject("");
    } catch { setMsg({ tone: "err", text: "Não foi possível salvar o provisionamento." }); }
    finally { setPending(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="discordSubject" className="text-sm font-bold text-ink block mb-2">Discord User ID (subject)</label>
        <input id="discordSubject" value={discordSubject} onChange={e=>setDiscordSubject(e.target.value)} className="checkout-input w-full" placeholder="Ex.: 123456789012345678" inputMode="numeric" autoComplete="off" />
        <p className="mt-1 text-xs text-muted">Nunca use email ou nome. O usuário deve autenticar com a conta Discord correspondente.</p>
      </div>
      {msg && <p className={`text-sm ${msg.tone === "ok" ? "text-emerald-200" : "text-rose-200"}`} role={msg.tone === "err" ? "alert" : "status"}>{msg.text}</p>}
      <button type="submit" className="button-primary" disabled={pending || !discordSubject.trim()}>{pending ? "Salvando…" : "Adicionar allowlist"}</button>
    </form>
  );
}
