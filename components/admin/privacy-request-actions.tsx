"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";
import type { AdminPrivacyAction } from "@/lib/privacy-request-api";

const actionsForStatus: Record<string, { action: AdminPrivacyAction; label: string; ownerOnly?: boolean }[]> = {
  OPEN: [{ action: "START_REVIEW", label: "Iniciar análise" }],
  IN_REVIEW: [
    { action: "RETURN_TO_QUEUE", label: "Voltar à fila" },
    { action: "COMPLETE", label: "Marcar atendimento concluído", ownerOnly: true },
    { action: "REJECT", label: "Encerrar após análise legal", ownerOnly: true },
  ],
};

export function PrivacyRequestActions({ id, status, isOwner }: { id: string; status: string; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const choices = (actionsForStatus[status] ?? []).filter(action => !action.ownerOnly || isOwner);

  async function run(action: AdminPrivacyAction) {
    if (busy) return;
    const attested = action === "COMPLETE" || action === "REJECT";
    if (attested && !window.confirm(
      "Confirme somente depois de verificar a identidade e concluir a análise fora do sistema. " +
      "Este botão NÃO apaga dados, NÃO entrega arquivos e NÃO envia notificações. Confirma a conclusão manual?"
    )) return;
    const csrf = extractCsrfTokenFromCookie();
    if (!csrf) { setError("Sessão de segurança ausente. Recarregue a página."); return; }
    setError(""); setSuccess(""); setBusy(true);
    try {
      const res = await fetch(`/api/admin/privacy-requests/${encodeURIComponent(id)}`, {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ action, expectedStatus: status, ...(attested ? { attested: true } : {}) }),
      });
      const result = await res.json().catch(() => ({})) as { error?: { message?: string } };
      if (!res.ok) throw new Error(result.error?.message || "Não foi possível atualizar.");
      setSuccess("Situação atualizada. A revisão humana e as obrigações legais continuam sob responsabilidade da equipe.");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha de conexão."); }
    finally { setBusy(false); }
  }

  if (!choices.length) return null;
  return <div className="mt-4 border-t border-white/10 pt-3">
    <div className="flex flex-wrap gap-2">
      {choices.map(choice => <button key={choice.action} type="button" disabled={busy}
        onClick={() => void run(choice.action)}
        className="min-h-11 rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-ink hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet disabled:opacity-50">
        {busy ? "Atualizando…" : choice.label}
      </button>)}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
    {success && <p role="status" className="mt-2 text-xs text-emerald-200">{success}</p>}
  </div>;
}
