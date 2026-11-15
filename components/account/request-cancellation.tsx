"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export function RequestCancellation({
  orderNumber, orderStatus, initialStatus,
}: { orderNumber: string; orderStatus: string; initialStatus: string | null }) {
  const router = useRouter();
  const [requestStatus, setRequestStatus] = useState(initialStatus);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const eligible = ["PENDING_PAYMENT", "PAID", "FULFILLED", "REVIEW_REQUIRED"].includes(orderStatus);

  async function submit() {
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setMessage("Sessão de segurança expirada. Atualize a página."); return; }
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch(`/api/user/orders/${encodeURIComponent(orderNumber)}/cancel`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      const body = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(body.error || "Não foi possível registrar a solicitação.");
      setRequestStatus(body.request?.status || "OPEN");
      setOpen(false);
      setMessage("Solicitação registrada. O pagamento e o acesso ao Minecraft não foram alterados automaticamente.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao registrar solicitação.");
    } finally {
      setBusy(false);
    }
  }

  if (requestStatus) return (
    <div className="max-w-56 space-y-1">
      <p className="text-xs font-semibold text-amber-200">Solicitação: {requestStatus === "OPEN" ? "Recebida" : requestStatus === "IN_REVIEW" ? "Em análise" : "Encerrada"}</p>
      {message && <p role="status" className="text-xs text-muted">{message}</p>}
    </div>
  );
  if (!eligible) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="max-w-60 space-y-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className="min-h-10 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-ink hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          Solicitar cancelamento
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs leading-5 text-muted">Sua solicitação será registrada para análise. Este botão não cancela uma cobrança nem realiza reembolso automaticamente.</p>
          <label className="block text-xs font-semibold text-ink" htmlFor={`reason-${orderNumber}`}>Motivo (opcional)</label>
          <textarea id={`reason-${orderNumber}`} value={reason} maxLength={800} rows={3}
            onChange={e => setReason(e.target.value)} className="checkout-input w-full text-sm" placeholder="Descreva o que aconteceu, se desejar." />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void submit()} className="button-primary px-3 py-2 text-xs">{busy ? "Enviando…" : "Enviar solicitação"}</button>
            <button type="button" disabled={busy} onClick={() => setOpen(false)} className="button-secondary px-3 py-2 text-xs">Voltar</button>
          </div>
        </div>
      )}
      {message && <p role="alert" className="text-xs text-rose-200">{message}</p>}
    </div>
  );
}
