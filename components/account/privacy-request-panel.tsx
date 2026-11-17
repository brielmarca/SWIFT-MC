"use client";
import { useEffect, useState, type FormEvent } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";
import { PRIVACY_REQUEST_KINDS, PRIVACY_REQUEST_LABELS, type PrivacyRequestKind } from "@/lib/privacy-request-input";

type Row = { id: string; kind: PrivacyRequestKind; status: string; createdAt: string };
const statusLabel: Record<string,string> = { OPEN: "Recebida", IN_REVIEW: "Em análise", CLOSED: "Concluída", REJECTED: "Encerrada após análise" };
export function PrivacyRequestPanel() {
  const [kind, setKind] = useState<PrivacyRequestKind>("ACCESS");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void fetch("/api/user/privacy-requests", { cache: "no-store", credentials: "same-origin" })
      .then(async res => { if (!res.ok) throw new Error(); const data = await res.json() as { requests?: Row[] }; if (!Array.isArray(data.requests)) throw new Error(); return data.requests; })
      .then(list => { if (active) setRows(list); })
      .catch(() => { if (active) setError("Não foi possível carregar suas solicitações."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(""); setMessage("");
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) return setError("Sessão do formulário indisponível. Recarregue a página.");
    setBusy(true);
    try {
      const res = await fetch("/api/user/privacy-requests", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ kind, ...(details.trim() ? { details: details.trim() } : {}) }),
      });
      const data = await res.json().catch(() => ({})) as { alreadyRequested?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error || "Não foi possível registrar a solicitação.");
      setMessage(data.alreadyRequested ? "Já existe uma solicitação desse tipo aguardando análise." : "Solicitação registrada para análise humana.");
      setDetails("");
      const updated = await fetch("/api/user/privacy-requests", { cache: "no-store" });
      if (updated.ok) { const payload = await updated.json() as { requests?: Row[] }; if (Array.isArray(payload.requests)) setRows(payload.requests); }
    } catch (err) { setError(err instanceof Error ? err.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }
  return <div className="grid gap-6 lg:grid-cols-2">
    <section className="glass-panel p-5 sm:p-6">
      <h2 className="text-lg font-bold">Nova solicitação</h2>
      <p className="mt-2 text-sm leading-6 text-muted">O registro não exclui nem exporta dados automaticamente. A equipe verificará identidade, limites legais e obrigações de retenção antes de atender ao pedido. Não envie documentos ou informações sensíveis neste campo.</p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div><label htmlFor="privacy-kind" className="block text-sm font-semibold">Tipo de solicitação</label>
          <select id="privacy-kind" className="checkout-input mt-2" value={kind} onChange={e => setKind(e.target.value as PrivacyRequestKind)}>
            {PRIVACY_REQUEST_KINDS.map(item => <option value={item} key={item}>{PRIVACY_REQUEST_LABELS[item]}</option>)}
          </select></div>
        <div><label htmlFor="privacy-details" className="block text-sm font-semibold">Informações adicionais (opcional)</label>
          <textarea id="privacy-details" value={details} maxLength={800} rows={4} onChange={e => setDetails(e.target.value)} className="checkout-input mt-2" placeholder="Descreva apenas o necessário, sem dados sensíveis." />
          <p className="mt-1 text-xs text-muted">{details.length}/800 caracteres</p></div>
        <button type="submit" disabled={busy} className="button-primary">{busy ? "Registrando…" : "Registrar solicitação"}</button>
        {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
        {error && <p role="alert" className="text-sm text-rose-200">{error}</p>}
      </form>
    </section>
    <section className="glass-panel p-5 sm:p-6">
      <h2 className="text-lg font-bold">Histórico de solicitações</h2>
      {loading ? <p role="status" className="mt-3 text-sm text-muted">Carregando…</p>
      : rows.length ? <ul className="mt-4 space-y-3">{rows.map(row => <li key={row.id} className="rounded-lg border border-white/10 p-3">
        <strong className="block text-sm">{PRIVACY_REQUEST_LABELS[row.kind] || row.kind}</strong>
        <span className="mt-1 block text-xs text-muted">{statusLabel[row.status] || row.status} · {new Date(row.createdAt).toLocaleDateString("pt-BR")}</span>
      </li>)}</ul>
      : <p className="mt-3 text-sm text-muted">Nenhuma solicitação registrada.</p>}
      <p className="mt-5 text-xs leading-5 text-muted">Este histórico mostra até 50 solicitações recentes.</p>
    </section>
  </div>;
}
