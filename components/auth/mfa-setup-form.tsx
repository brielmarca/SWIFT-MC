"use client";
import { useEffect, useState } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export function MfaSetupForm({ displayName }: { displayName: string }) {
  const [status, setStatus] = useState<{ discordLinked: boolean; mfaEnabled: boolean } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => { (async () => {
    const res = await fetch("/api/user/mfa", { cache: "no-store" }); const data = await res.json().catch(()=>null); if (res.ok) setStatus(data);
  })(); }, []);

  async function start() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf) return setMsg({ tone: "err", text: "Recarregue a página." });
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/user/mfa", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ setup: true }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data?.error?.message || "fail");
      setSecret(data.secret); setUri(data.otpauthUri);
    } catch { setMsg({ tone: "err", text: "Não foi possível iniciar MFA. Vincule Discord e configure AUTH_ENCRYPTION_KEY." }); }
    finally { setPending(false); }
  }

  async function enable() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf || !secret) return;
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/user/mfa", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ secret, code }) });
      if (!res.ok) throw new Error();
      setMsg({ tone: "ok", text: "MFA ativado. Use seu app autenticador em logins administrativos." });
      setStatus(s => s ? { ...s, mfaEnabled: true } : s); setSecret(null); setUri(null); setCode("");
    } catch { setMsg({ tone: "err", text: "Código inválido ou MFA indisponível." }); }
    finally { setPending(false); }
  }

  if (!status) return <p className="text-sm text-muted">Carregando…</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Conta: <span className="text-ink font-medium">{displayName}</span></p>
      <p className="text-sm">{status.mfaEnabled ? "MFA está ativado." : "MFA não está ativado."}</p>
      {!status.discordLinked && <p className="text-sm text-amber-200">Vincule uma conta Discord para ativar MFA administrativo.</p>}
      {status.discordLinked && !status.mfaEnabled && !secret && <button type="button" className="button-primary" onClick={()=>void start()} disabled={pending}>Gerar segredo MFA</button>}
      {secret && uri && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Adicione este segredo ao seu app autenticador (TOTP):</p>
          <code className="block break-all rounded bg-black/30 p-3 text-xs text-ink">{secret}</code>
          <code className="block break-all rounded bg-black/30 p-3 text-[11px] text-muted">{uri}</code>
          <label className="block text-sm font-bold text-ink">Código de 6 dígitos
            <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" className="checkout-input mt-2 w-40" />
          </label>
          <button type="button" className="button-primary" onClick={()=>void enable()} disabled={pending || code.length !== 6}>Ativar MFA</button>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.tone==="ok"?"text-emerald-200":"text-rose-200"}`} role={msg.tone==="err"?"alert":"status"}>{msg.text}</p>}
    </div>
  );
}
