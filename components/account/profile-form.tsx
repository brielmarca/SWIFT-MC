"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Mail, AlertCircle, CheckCircle } from "lucide-react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

export function ProfileForm({ initialDisplayName, initialEmail }: { initialDisplayName: string; initialEmail: string }) {
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      setMessage({ type: "error", text: "O nome de exibição é obrigatório." });
      return;
    }

    if (displayName.length > 100) {
      setMessage({ type: "error", text: "O nome de exibição deve ter no máximo 100 caracteres." });
      return;
    }

    const csrfToken = extractCsrfTokenFromCookie();
    if (!csrfToken) {
      setMessage({ type: "error", text: "Não foi possível atualizar o perfil com segurança. Recarregue a página e tente novamente." });
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Perfil atualizado com sucesso." });
        setDisplayName(displayName.trim());
      } else {
        setMessage({ type: "error", text: data.error?.message || "Não foi possível atualizar o perfil." });
      }
    } catch {
      setMessage({ type: "error", text: "Não foi possível atualizar o perfil. Tente novamente." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-5 sm:p-6 space-y-6" noValidate>
      <div className="space-y-4">
        <div>
          <label htmlFor="displayName" className="text-sm font-bold text-ink block mb-2">
            Nome de exibição
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
            autoComplete="name"
            required
            className="checkout-input mt-2 w-full sm:w-auto"
            disabled={pending}
          />
          <p className="mt-1 text-xs text-muted">
            Seu nome de exibição é visível para outros usuários da Swift MC.
          </p>
        </div>

        <div className="border-t border-white/10 pt-4">
          <div className="flex items-start gap-3">
            <Mail size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
            <div>
              <p className="micro-label">Endereço de e-mail</p>
              <p className="font-medium text-ink">{initialEmail}</p>
              <p className="mt-1 text-xs text-amber-200">
                O e-mail não pode ser alterado nesta página.
              </p>
            </div>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg px-3 py-2 text-sm font-medium flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-200"
          }`}
        >
          {message.type === "success" ? <CheckCircle size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
          <span>{message.text}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || !displayName.trim()}
        className="button-primary w-full sm:w-auto"
      >
        {pending ? "Atualizando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
