"use client";
import { useState } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

type Props = { displayName: string; email: string | null; mfaEnabled: boolean; pendingSetup: boolean; recoveryCodesRemaining: number; mfaVerified: boolean; canProvision: boolean };

export function AdminSecurityPanel({ displayName, email, mfaEnabled, pendingSetup, recoveryCodesRemaining, mfaVerified, canProvision }: Props) {
  const [status, setStatus] = useState({ mfaEnabled, pendingSetup, recoveryCodesRemaining });
  const [otpauthUri, setOtpauthUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableRecovery, setDisableRecovery] = useState("");
  const [disableUseRecovery, setDisableUseRecovery] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [regenRecovery, setRegenRecovery] = useState("");
  const [regenUseRecovery, setRegenUseRecovery] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");

  async function startSetup() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf) return setMsg({ tone: "err", text: "Recarregue a página." });
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/mfa/setup/start", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Falha ao iniciar.");
      setOtpauthUri(data.otpauthUri); setStatus(s => ({ ...s, pendingSetup: true }));
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Não foi possível iniciar MFA." }); }
    finally { setPending(false); }
  }

  async function confirmSetup() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf) return;
    setPending(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/mfa/setup/confirm", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ code: code.replace(/\D/g,"").slice(0,6) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Código inválido.");
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setOtpauthUri(null); setCode(""); setStatus({ mfaEnabled: true, pendingSetup: false, recoveryCodesRemaining: (data.recoveryCodes||[]).length });
      setMsg({ tone: "ok", text: "MFA ativado. Guarde os códigos de recuperação em local seguro; eles não serão exibidos novamente." });
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Não foi possível confirmar o MFA." }); }
    finally { setPending(false); }
  }

  async function disableMfa() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf) return setMsg({ tone: "err", text: "Recarregue a página." });
    setPending(true); setMsg(null);
    try {
      const issue = await fetch("/api/admin/mfa/challenge/issue", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ purpose: "DISABLE" }) });
      const issued = await issue.json().catch(() => ({}));
      if (!issue.ok || !issued?.challengeToken) throw new Error(issued?.error?.message || "Não foi possível iniciar verificação para desativação.");
      const body = disableUseRecovery
        ? { challengeToken: issued.challengeToken, recoveryCode: disableRecovery.trim(), password: disablePassword || undefined }
        : { challengeToken: issued.challengeToken, code: disableCode.replace(/\D/g,"").slice(0,6), password: disablePassword || undefined };
      const res = await fetch("/api/admin/mfa/disable", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Não foi possível desativar o MFA.");
      setMsg({ tone: "ok", text: "MFA desativado e sessões revogadas. Faça login novamente para configurar com segurança." });
      setStatus({ mfaEnabled: false, pendingSetup: false, recoveryCodesRemaining: 0 });
      setDisableOpen(false);
      window.location.href = "/login";
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Falha ao desativar MFA." }); }
    finally { setPending(false); }
  }

  async function regenerateRecovery() {
    const csrf = extractCsrfTokenFromCookie(); if (!csrf) return setMsg({ tone: "err", text: "Recarregue a página." });
    setPending(true); setMsg(null);
    try {
      const issue = await fetch("/api/admin/mfa/challenge/issue", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ purpose: "DISABLE" }) });
      const issued = await issue.json().catch(() => ({}));
      if (!issue.ok || !issued?.challengeToken) throw new Error(issued?.error?.message || "Não foi possível iniciar verificação.");
      const body = regenUseRecovery
        ? { challengeToken: issued.challengeToken, recoveryCode: regenRecovery.trim(), password: regenPassword || undefined }
        : { challengeToken: issued.challengeToken, code: regenCode.replace(/\D/g,"").slice(0,6), password: regenPassword || undefined };
      const res = await fetch("/api/admin/mfa/recovery/regenerate", { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Não foi possível regenerar códigos.");
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setMsg({ tone: "ok", text: "Códigos regenerados. Códigos anteriores foram invalidados e sessões revogadas; salve os novos códigos agora." });
      setRegenOpen(false);
      window.location.href = "/login";
    } catch (e) { setMsg({ tone: "err", text: e instanceof Error ? e.message : "Falha ao regenerar códigos." }); }
    finally { setPending(false); }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-sm">
        <p className="text-muted">Conta: <span className="text-ink font-medium">{displayName}</span>{email ? <span className="text-muted"> · {email}</span> : null}</p>
        <p className="text-ink">MFA: <span className={status.mfaEnabled ? "text-emerald-200 font-semibold" : "text-amber-200 font-semibold"}>{status.mfaEnabled ? "Ativo" : "Não configurado"}</span></p>
        {status.mfaEnabled && <p className="text-muted">Códigos de recuperação restantes: {status.recoveryCodesRemaining}</p>}
        <p className="text-muted">Sessão MFA elevada: {mfaVerified ? "sim" : "não"}</p>
      </div>

      {!status.mfaEnabled && !otpauthUri && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Use um aplicativo autenticador (TOTP). O segredo é gerado no servidor e nunca é aceito do cliente. Após ativar, o acesso administrativo exigirá verificação MFA.</p>
          <button type="button" className="button-primary" onClick={()=>void startSetup()} disabled={pending}>Iniciar configuração segura</button>
        </div>
      )}

      {otpauthUri && (
        <div className="space-y-3 rounded border border-violet/30 bg-black/20 p-4">
          <p className="text-sm text-ink font-semibold">Configuração pendente</p>
          <p className="text-sm text-muted">Adicione esta conta no seu autenticador usando a URI abaixo (ou escaneie via app compatível com otpauth). O segredo não será exibido novamente após a confirmação.</p>
          <code className="block break-all rounded bg-black/40 p-3 text-[11px] text-muted">{otpauthUri}</code>
          <label className="block text-sm font-bold text-ink">Código de confirmação
            <input value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" className="checkout-input mt-2 w-44" />
          </label>
          <button type="button" className="button-primary" onClick={()=>void confirmSetup()} disabled={pending || code.length !== 6}>Confirmar e ativar MFA</button>
        </div>
      )}

      {recoveryCodes && recoveryCodes.length > 0 && (
        <div className="space-y-3 rounded border border-amber-400/30 bg-amber-500/5 p-4">
          <p className="text-sm font-semibold text-amber-100">Códigos de recuperação (uso único)</p>
          <p className="text-sm text-muted">Salve agora em local seguro. Cada código pode ser usado apenas uma vez e não será mostrado novamente.</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-xs text-ink">{recoveryCodes.map(c => <li key={c} className="rounded bg-black/30 px-2 py-1">{c}</li>)}</ul>
        </div>
      )}

      {status.mfaEnabled && (
        <div className="space-y-3 border-t border-white/10 pt-4 text-sm">
          <p className="text-muted">Regeneração de recuperação é operação crítica: exige sessão elevada por MFA, verificação adicional, reautenticação segura, invalida códigos anteriores e revoga sessões.</p>
          {!regenOpen ? (
            <button type="button" className="button-secondary px-4" onClick={()=>setRegenOpen(true)} disabled={pending || !mfaVerified}>Regenerar códigos de recuperação</button>
          ) : (
            <div className="space-y-3 rounded border border-amber-400/30 bg-amber-500/5 p-4">
              <p className="font-semibold text-amber-100">Confirmar regeneração de recuperação</p>
              {!regenUseRecovery ? (
                <label className="block text-sm font-bold text-ink">Código TOTP
                  <input value={regenCode} onChange={e=>setRegenCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" className="checkout-input mt-2 w-44" />
                </label>
              ) : (
                <label className="block text-sm font-bold text-ink">Código de recuperação atual
                  <input value={regenRecovery} onChange={e=>setRegenRecovery(e.target.value)} className="checkout-input mt-2 w-full" />
                </label>
              )}
              <label className="block text-sm font-bold text-ink">Senha atual (reautenticação, se aplicável)
                <input type="password" value={regenPassword} onChange={e=>setRegenPassword(e.target.value)} autoComplete="current-password" className="checkout-input mt-2 w-full" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="button-primary" onClick={()=>void regenerateRecovery()} disabled={pending || (regenUseRecovery ? regenRecovery.trim().length < 8 : regenCode.length !== 6)}>Confirmar regeneração</button>
                <button type="button" className="button-secondary px-4" onClick={()=>setRegenUseRecovery(v=>!v)}>{regenUseRecovery ? "Usar TOTP" : "Usar recuperação"}</button>
                <button type="button" className="button-secondary px-4" onClick={()=>setRegenOpen(false)}>Cancelar</button>
              </div>
            </div>
          )}
          <p className="text-muted pt-2">Desativação é uma operação crítica: exige sessão elevada por MFA, verificação MFA adicional, reautenticação segura e revoga todas as sessões.</p>
          {!disableOpen ? (
            <button type="button" className="button-secondary px-4" onClick={()=>setDisableOpen(true)} disabled={pending || !mfaVerified}>Desativar MFA (operação crítica)</button>
          ) : (
            <div className="space-y-3 rounded border border-rose-400/30 bg-rose-500/5 p-4">
              <p className="font-semibold text-rose-100">Confirmar desativação de MFA</p>
              {!disableUseRecovery ? (
                <label className="block text-sm font-bold text-ink">Código TOTP
                  <input value={disableCode} onChange={e=>setDisableCode(e.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" className="checkout-input mt-2 w-44" />
                </label>
              ) : (
                <label className="block text-sm font-bold text-ink">Código de recuperação
                  <input value={disableRecovery} onChange={e=>setDisableRecovery(e.target.value)} className="checkout-input mt-2 w-full" />
                </label>
              )}
              <label className="block text-sm font-bold text-ink">Senha atual (reautenticação, se aplicável)
                <input type="password" value={disablePassword} onChange={e=>setDisablePassword(e.target.value)} autoComplete="current-password" className="checkout-input mt-2 w-full" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="button-primary" onClick={()=>void disableMfa()} disabled={pending || (disableUseRecovery ? disableRecovery.trim().length < 8 : disableCode.length !== 6)}>Confirmar desativação</button>
                <button type="button" className="button-secondary px-4" onClick={()=>setDisableUseRecovery(v=>!v)}>{disableUseRecovery ? "Usar TOTP" : "Usar recuperação"}</button>
                <button type="button" className="button-secondary px-4" onClick={()=>setDisableOpen(false)}>Cancelar</button>
              </div>
              <p className="text-xs text-muted">Se sua conta não possui senha, a reautenticação recente pode ser exigida conforme política.</p>
            </div>
          )}
          {canProvision && <p className="text-xs text-muted">Permissão OWNER detectada: provisionamento crítico restrito a <code className="text-ink">security:configure</code> com MFA validado.</p>}
        </div>
      )}

      {msg && <p className={`text-sm ${msg.tone==="ok"?"text-emerald-200":"text-rose-200"}`} role={msg.tone==="err"?"alert":"status"}>{msg.text}</p>}
    </div>
  );
}
