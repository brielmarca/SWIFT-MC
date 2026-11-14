"use client";
import { useEffect, useState } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

type Props = { callbackUrl: string; displayName: string; mfaEnabled: boolean; pendingSetup: boolean };

export function AdminMfaLogin({ callbackUrl, displayName, mfaEnabled, pendingSetup }: Props) {
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!mfaEnabled) return;
    void (async () => {
      const csrf = extractCsrfTokenFromCookie(); if (!csrf) return;
      const res = await fetch("/api/admin/mfa/challenge/issue", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ purpose: "ELEVATION" }) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.challengeToken) setChallengeToken(data.challengeToken);
      else setMsg(data?.error?.message || "Não foi possível iniciar o desafio MFA.");
    })();
  }, [mfaEnabled]);

  if (!mfaEnabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">Olá, <span className="font-semibold">{displayName}</span>. Sua conta administrativa exige MFA ativo antes do acesso ao painel.</p>
        <p className="text-sm text-muted">Conclua a configuração segura do autenticador. O acesso administrativo permanecerá bloqueado até a confirmação.</p>
        <a href="/admin/security" className="button-primary inline-flex">Configurar MFA</a>
      </div>
    );
  }

  async function verify() {
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf || !challengeToken) { setMsg("Recarregue a página e tente novamente."); return; }
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/mfa/challenge/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(useRecovery ? { challengeToken, recoveryCode: recoveryCode.trim(), purpose: "ELEVATION" } : { challengeToken, code: code.replace(/\D/g, "").slice(0,6), purpose: "ELEVATION" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Verificação inválida.");
      window.location.href = callbackUrl || "/admin";
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Código inválido ou expirado.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Conta: <span className="text-ink font-medium">{displayName}</span></p>
      {pendingSetup && <p className="text-sm text-amber-200">Existe uma configuração de MFA pendente. Conclua em Segurança administrativa.</p>}
      <p className="text-sm text-muted">Digite o código do seu aplicativo autenticador para elevar esta sessão.</p>
      {!useRecovery ? (
        <label className="block text-sm font-bold text-ink">Código de 6 dígitos
          <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="checkout-input mt-2 w-44" />
        </label>
      ) : (
        <label className="block text-sm font-bold text-ink">Código de recuperação
          <input value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)} autoComplete="off" className="checkout-input mt-2 w-full" />
        </label>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className="button-primary" onClick={()=>void verify()} disabled={pending || !challengeToken || (useRecovery ? recoveryCode.trim().length < 8 : code.length !== 6)}>{pending ? "Verificando…" : "Verificar e acessar"}</button>
        <button type="button" className="button-secondary px-4" onClick={()=>{ setUseRecovery(v=>!v); setMsg(null); }}>{useRecovery ? "Usar código TOTP" : "Usar código de recuperação"}</button>
      </div>
      {msg && <p className="text-sm text-rose-200" role="alert">{msg}</p>}
      <p className="text-xs text-muted">Sessões administrativas expiram em 8h (absoluto) e 30min de inatividade. A confiança MFA não é renovada por atividade.</p>
    </div>
  );
}
