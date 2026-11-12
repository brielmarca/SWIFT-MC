"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle, Copy, Link2, Mail, Phone, Shield, Unlink, User } from "lucide-react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";
import { DiscordAuthButton } from "@/components/auth/discord-auth-button";

type Msg = { type: "success" | "error"; text: string } | null;
type Linked = {
  email: string | null;
  hasPassword: boolean;
  discord: { linked: true; providerSubject: string } | { linked: false };
  minecraft: { linked: true; uuid: string; nickname: string | null; verifiedAt: string } | { linked: false };
  mfaEnabled: boolean;
};

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${msg.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200" : "bg-rose-500/10 border border-rose-500/20 text-rose-200"}`} role={msg.type === "error" ? "alert" : "status"}>
      {msg.type === "success" ? <CheckCircle size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
      <span>{msg.text}</span>
    </div>
  );
}

function errMsg(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    const err = rec.error as { message?: unknown } | undefined;
    if (err && typeof err.message === "string") return err.message;
    if (typeof rec.message === "string") return rec.message;
    if (typeof rec.acknowledgement === "string") return rec.acknowledgement;
  }
  return fallback;
}

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const csrf = extractCsrfTokenFromCookie();
  if (!csrf) return { ok: false, status: 0, data: { error: { message: "Sessão de formulário ausente. Recarregue a página." } } };
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(body), credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function AccountSettings({ initialDisplayName, initialEmail, initialEmailVerified, initialPhone }: { initialDisplayName: string; initialEmail: string; initialEmailVerified: boolean; initialPhone: string | null }) {
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [emailMsg, setEmailMsg] = useState<Msg>(null);
  const [linksMsg, setLinksMsg] = useState<Msg>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [phone, setPhone] = useState(initialPhone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendMsg, setResendMsg] = useState<Msg>(null);

  const [linked, setLinked] = useState<Linked | null>(null);
  const [mcCode, setMcCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [unlinkPassword, setUnlinkPassword] = useState("");

  async function refreshLinks() {
    const res = await fetch("/api/user/linked-accounts", { cache: "no-store", credentials: "same-origin" });
    const data = await res.json().catch(() => null);
    return res.ok ? (data as Linked) : null;
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await refreshLinks();
      if (active && data) setLinked(data);
    })();
    return () => { active = false; };
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return setProfileMsg({ type: "error", text: "O nome de exibição é obrigatório." });
    setSavingProfile(true); setProfileMsg(null);
    const { ok, data } = await postJson("/api/user/profile", { displayName: displayName.trim(), phoneE164: phone.trim() ? phone.trim() : null });
    setSavingProfile(false);
    if (!ok) return setProfileMsg({ type: "error", text: errMsg(data, "Não foi possível atualizar o perfil.") });
    setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso." });
    const u = data.user as { displayName?: string; phoneE164?: string | null } | undefined;
    setDisplayName(u?.displayName || displayName.trim());
    setPhone(u?.phoneE164 || "");
  }

  async function requestEmailChange(e: FormEvent) {
    e.preventDefault();
    const needsPassword = linked?.hasPassword !== false;
    if (!newEmail || (needsPassword && !emailPassword)) return setEmailMsg({ type: "error", text: needsPassword ? "Informe o novo e-mail e sua senha atual." : "Informe o novo e-mail." });
    setSavingEmail(true); setEmailMsg(null);
    const payload: { newEmail: string; currentPassword?: string } = { newEmail };
    if (emailPassword) payload.currentPassword = emailPassword;
    const { ok, data } = await postJson("/api/user/email/change-request", payload);
    setSavingEmail(false);
    if (!ok) return setEmailMsg({ type: "error", text: errMsg(data, "Não foi possível solicitar a alteração.") });
    setEmailMsg({ type: "success", text: (typeof data.acknowledgement === "string" && data.acknowledgement) || "Se for possível, enviaremos a confirmação para o novo email." });
    setEmailPassword("");
  }

  async function resendVerification() {
    if (!initialEmail || resendingVerification) return;
    setResendingVerification(true); setResendMsg(null);
    try {
      const { ok, data } = await postJson("/api/auth/resend-verification", { email: initialEmail });
      setResendMsg(ok
        ? { type: "success", text: (typeof data.acknowledgement === "string" && data.acknowledgement) || "Se possível, enviaremos um novo link para o seu e-mail." }
        : { type: "error", text: errMsg(data, "Não foi possível reenviar a verificação.") });
    } catch {
      setResendMsg({ type: "error", text: "Não foi possível reenviar a verificação." });
    } finally { setResendingVerification(false); }
  }

  async function unlinkDiscord(e: FormEvent) {
    e.preventDefault();
    if (!unlinkPassword) return setLinksMsg({ type: "error", text: "Informe sua senha para desvincular com segurança." });
    setPendingAction("discord"); setLinksMsg(null);
    const { ok, data } = await postJson("/api/user/discord/unlink", { currentPassword: unlinkPassword });
    setPendingAction(null);
    if (!ok) return setLinksMsg({ type: "error", text: errMsg(data, "Não foi possível desvincular o Discord.") });
    setLinksMsg({ type: "success", text: (typeof data.message === "string" && data.message) || "Discord desvinculado. Faça login novamente." });
    setUnlinkPassword("");
    setTimeout(() => { window.location.href = "/login"; }, 1200);
  }

  async function generateMinecraftCode() {
    setPendingAction("mc-code"); setLinksMsg(null); setMcCode(null);
    const { ok, data } = await postJson("/api/user/minecraft/link-code", {});
    setPendingAction(null);
    if (!ok) return setLinksMsg({ type: "error", text: errMsg(data, "Não foi possível gerar o código.") });
    if (typeof data.code === "string" && typeof data.expiresAt === "string") {
      setMcCode({ code: data.code, expiresAt: data.expiresAt });
    }
    const refreshed = await refreshLinks();
    if (refreshed) setLinked(refreshed);
  }

  async function unlinkMinecraft(e: FormEvent) {
    e.preventDefault();
    const needsPassword = linked?.hasPassword !== false;
    if (needsPassword && !unlinkPassword) return setLinksMsg({ type: "error", text: "Informe sua senha para confirmar a desvinculação." });
    setPendingAction("mc-unlink"); setLinksMsg(null);
    const payload: { currentPassword?: string } = {};
    if (unlinkPassword) payload.currentPassword = unlinkPassword;
    const { ok, data } = await postJson("/api/user/minecraft/unlink", payload);
    setPendingAction(null);
    if (!ok) return setLinksMsg({ type: "error", text: errMsg(data, "Não foi possível desvincular o Minecraft.") });
    setLinksMsg({ type: "success", text: (typeof data.message === "string" && data.message) || "Minecraft desvinculado." });
    setUnlinkPassword(""); setMcCode(null);
    const refreshed = await refreshLinks();
    if (refreshed) setLinked(refreshed);
  }

  async function copyCode() {
    if (!mcCode) return;
    try { await navigator.clipboard.writeText(mcCode.code); setLinksMsg({ type: "success", text: "Código copiado." }); } catch { setLinksMsg({ type: "error", text: "Não foi possível copiar o código." }); }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={saveProfile} className="glass-panel p-5 sm:p-6 space-y-5" noValidate>
        <div className="flex items-center gap-2"><User size={18} className="text-violet" aria-hidden="true" /><h2 className="text-lg font-bold text-ink">Perfil</h2></div>
        <div className="space-y-4">
          <label className="block text-sm font-bold text-ink">Nome de exibição
            <input value={displayName} onChange={e=>setDisplayName(e.target.value)} maxLength={100} autoComplete="name" required className="checkout-input mt-2 w-full" disabled={savingProfile} />
          </label>
          <label className="block text-sm font-bold text-ink"><span className="inline-flex items-center gap-2"><Phone size={14} aria-hidden="true" />Telefone (opcional)</span>
            <input value={phone} onChange={e=>setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="+5511999999999" className="checkout-input mt-2 w-full" disabled={savingProfile} />
            <p className="mt-1 text-xs text-muted font-normal">Formato internacional (E.164), ex.: +5511999999999. Deixe em branco para remover.</p>
          </label>
          <div className="border-t border-white/10 pt-4 flex items-start gap-3">
            <Mail size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <p className="micro-label">Endereço de e-mail</p>
              <p className="font-medium text-ink">{initialEmail || "Não cadastrado"}</p>
              <p className="mt-1 text-xs text-muted">{initialEmail ? "Para alterar, use a seção “Alterar e-mail” abaixo." : "Adicione um e-mail e confirme o link recebido para liberar as compras."}</p>
            </div>
          </div>
        </div>
        <Notice msg={profileMsg} />
        <button type="submit" disabled={savingProfile || !displayName.trim()} className="button-primary w-full sm:w-auto">{savingProfile ? "Salvando…" : "Salvar perfil"}</button>
      </form>

      {initialEmail && !initialEmailVerified && (
        <section id="email-verification" className="glass-panel p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2"><Mail size={18} className="text-violet" aria-hidden="true" /><h2 className="text-lg font-bold text-ink">Verificar e-mail existente</h2></div>
          <p className="text-sm text-muted">Seu endereço {initialEmail} ainda não foi confirmado. Reenvie o link para verificar sua conta; não é necessário alterar o endereço nem informar a senha.</p>
          <Notice msg={resendMsg} />
          <button type="button" className="button-primary w-full sm:w-auto" onClick={() => void resendVerification()} disabled={resendingVerification}>
            {resendingVerification ? "Enviando…" : "Reenviar link de verificação"}
          </button>
        </section>
      )}
      <form id={initialEmail ? "email-change" : "email-verification"} onSubmit={requestEmailChange} className="glass-panel p-5 sm:p-6 space-y-5" noValidate>
        <div className="flex items-center gap-2"><Mail size={18} className="text-violet" aria-hidden="true" /><h2 className="text-lg font-bold text-ink">{initialEmail ? "Alterar e-mail" : "Adicionar e verificar e-mail"}</h2></div>
        <p className="text-sm text-muted">{initialEmail ? "Por segurança, confirme sua identidade. Enviaremos um link para o novo e-mail e encerraremos suas sessões após a confirmação." : "Cadastre seu primeiro e-mail para receber um link de verificação. Contas Discord sem senha utilizam uma sessão autenticada recentemente."}</p>
        <div className="space-y-4">
          <label className="block text-sm font-bold text-ink">{initialEmail ? "Novo e-mail" : "E-mail para verificação"}
            <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required autoComplete="email" className="checkout-input mt-2 w-full" disabled={savingEmail} />
          </label>
          {linked?.hasPassword !== false ? (
            <label className="block text-sm font-bold text-ink">Senha atual
              <input type="password" value={emailPassword} onChange={e=>setEmailPassword(e.target.value)} required autoComplete="current-password" className="checkout-input mt-2 w-full" disabled={savingEmail} />
            </label>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-muted">Sua conta não possui senha (login por Discord). Se você fez login recentemente, a confirmação pode prosseguir sem senha; caso contrário, faça login novamente por segurança.</div>
          )}
        </div>
        <Notice msg={emailMsg} />
        {linked?.hasPassword === false && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Se sua última autenticação tiver mais de 10 minutos, use o botão abaixo antes de solicitar o link.</p>
            <DiscordAuthButton label="Autenticar novamente com Discord" returnPath="/account/profile" />
          </div>
        )}
        <button type="submit" disabled={savingEmail || !newEmail || (linked?.hasPassword !== false && !emailPassword)} className="button-primary w-full sm:w-auto">{savingEmail ? "Enviando…" : "Enviar confirmação"}</button>
      </form>

      <section id="linked" className="glass-panel p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2"><Link2 size={18} className="text-violet" aria-hidden="true" /><h2 className="text-lg font-bold text-ink">Contas vinculadas</h2></div>
        <p className="text-sm text-muted">Gerencie logins e vínculos. Por segurança, desvincular pode exigir sua senha e encerrar sessões.</p>

        <div className="space-y-4 border-t border-white/10 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-ink flex items-center gap-2"><Shield size={16} aria-hidden="true" />Discord</p>
              <p className="text-sm text-muted mt-1">{linked?.discord.linked ? "Conta Discord vinculada." : "Nenhuma conta Discord vinculada."}</p>
              {linked?.mfaEnabled && <p className="text-xs text-amber-200 mt-1">MFA está ativo; desvincular o Discord também removerá o MFA desta conta.</p>}
            </div>
            <div className="shrink-0">
              {linked?.discord.linked ? null : <DiscordAuthButton intent="LINK" returnPath="/account/profile" label="Vincular Discord" />}
            </div>
          </div>
          {linked?.discord.linked && (
            <form onSubmit={unlinkDiscord} className="space-y-3 rounded-lg border border-white/10 p-3">
              {!linked.hasPassword ? <p className="text-sm text-amber-200">Defina uma senha na sua conta antes de desvincular o Discord para evitar perda de acesso.</p> : <>
                <label className="block text-sm font-medium text-ink">Senha atual para confirmar
                  <input type="password" value={unlinkPassword} onChange={e=>setUnlinkPassword(e.target.value)} autoComplete="current-password" className="checkout-input mt-2 w-full sm:max-w-xs" />
                </label>
                <button type="submit" disabled={pendingAction==="discord" || !unlinkPassword} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"><Unlink size={16} aria-hidden="true" />{pendingAction==="discord"?"Desvinculando…":"Desvincular Discord"}</button>
              </>}
            </form>
          )}
        </div>

        <div className="space-y-4 border-t border-white/10 pt-4">
          <div>
            <p className="font-semibold text-ink flex items-center gap-2"><Link2 size={16} aria-hidden="true" />Minecraft (Java)</p>
            <p className="text-sm text-muted mt-1">
              {linked?.minecraft.linked ? `Vinculado: ${linked.minecraft.nickname || linked.minecraft.uuid}` : "Nenhuma conta Minecraft vinculada."}
            </p>
            {linked?.minecraft.linked && <p className="text-xs text-muted mt-1 break-all">UUID: {linked.minecraft.uuid}</p>}
          </div>
          <div className="space-y-3 rounded-lg border border-white/10 p-3">
            <p className="text-sm text-muted">Vincule pelo servidor usando um código verificado (UUID). Gere um código e use no jogo conforme instruções do servidor.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>void generateMinecraftCode()} disabled={pendingAction==="mc-code"} className="button-primary">{pendingAction==="mc-code"?"Gerando…":"Gerar código de vínculo"}</button>
              <button type="button" onClick={()=>void refreshLinks().then(d=>{if(d)setLinked(d);})} className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/5">Atualizar status</button>
            </div>
            {mcCode && (
              <div className="rounded-lg bg-black/30 p-3 space-y-2">
                <p className="micro-label">Código (expira em 15 min)</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm text-ink break-all">{mcCode.code}</code>
                  <button type="button" onClick={()=>void copyCode()} className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs hover:bg-white/5"><Copy size={14} aria-hidden="true" />Copiar</button>
                </div>
                <p className="text-xs text-muted">Expira em: {new Date(mcCode.expiresAt).toLocaleString("pt-BR")}</p>
              </div>
            )}
            {linked?.minecraft.linked && (
              <form onSubmit={unlinkMinecraft} className="space-y-3 pt-2 border-t border-white/10">
                <p className="text-sm text-amber-200">Desvincular remove o vínculo verificado do jogador no servidor. Seus benefícios VIP pagos permanecem na sua conta e poderão ser vinculados novamente com segurança (não são revogados silenciosamente).</p>
                {linked.hasPassword ? <>
                  <label className="block text-sm font-medium text-ink">Senha atual
                    <input type="password" value={unlinkPassword} onChange={e=>setUnlinkPassword(e.target.value)} autoComplete="current-password" className="checkout-input mt-2 w-full sm:max-w-xs" />
                  </label>
                  <button type="submit" disabled={pendingAction==="mc-unlink" || !unlinkPassword} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"><Unlink size={16} aria-hidden="true" />{pendingAction==="mc-unlink"?"Desvinculando…":"Desvincular Minecraft"}</button>
                </> : <>
                  <p className="text-sm text-muted">Conta sem senha (login por Discord): se você fez login recentemente, pode confirmar a desvinculação sem senha; caso contrário, faça login novamente por segurança.</p>
                  <button type="submit" disabled={pendingAction==="mc-unlink"} className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"><Unlink size={16} aria-hidden="true" />{pendingAction==="mc-unlink"?"Desvinculando…":"Desvincular Minecraft"}</button>
                </>}
              </form>
            )}
          </div>
        </div>
        <Notice msg={linksMsg} />
      </section>
    </div>
  );
}
