"use client";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export function ConfirmEmailForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf || !token) { setMsg({ tone: "err", text: "Link inválido ou sessão de formulário ausente. Recarregue a página." }); return; }
    setPending(true); setMsg(null);
    try {
      const payload: { email: string; challengeToken: string; currentPassword?: string } = { email, challengeToken: token };
      if (currentPassword) payload.currentPassword = currentPassword;
      const res = await fetch("/api/user/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || "Falha");
      setMsg({ tone: "ok", text: data.message || "E-mail alterado. Faça login novamente." });
      setTimeout(() => { window.location.href = "/login"; }, 1200);
    } catch (err) {
      setMsg({ tone: "err", text: err instanceof Error ? err.message : "Não foi possível confirmar o novo e-mail." });
    } finally { setPending(false); }
  }

  if (!token) return <p className="text-sm text-rose-200">Link de confirmação inválido ou ausente.</p>;
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-bold text-ink">Novo e-mail
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" className="checkout-input mt-2 w-full" disabled={pending} />
      </label>
      <label className="block text-sm font-bold text-ink">Senha atual (se sua conta tiver senha)
        <input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" className="checkout-input mt-2 w-full" disabled={pending} />
        <p className="mt-1 text-xs text-muted font-normal">Contas sem senha (ex.: login por Discord) podem confirmar com uma sessão recente; se necessário, faça login novamente.</p>
      </label>
      {msg && <p className={`text-sm ${msg.tone==="ok"?"text-emerald-200":"text-rose-200"}`} role={msg.tone==="err"?"alert":"status"}>{msg.text}</p>}
      <button type="submit" className="button-primary" disabled={pending || !email}>{pending ? "Confirmando…" : "Confirmar alteração"}</button>
    </form>
  );
}
