"use client";

import { LogOut } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const errorId = useId();

  async function logout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || inFlight.current) return;
    setError(null);
    const csrfToken = extractCsrfTokenFromCookie();
    if (!csrfToken) {
      setError("Não foi possível sair com segurança. Atualize a página e tente novamente.");
      return;
    }

    inFlight.current = true;
    setPending(true);
    try {
      const response = await fetch("/api/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) throw new Error("Logout rejected");
      const result = await response.json();
      if (result.ok !== true) throw new Error("Logout not confirmed");
      // A full navigation discards cached authenticated UI after cookies clear.
      window.location.assign("/");
    } catch {
      setError("Não foi possível sair. Atualize a página e tente novamente.");
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form action="/api/logout" method="POST" onSubmit={logout} className="relative" aria-busy={pending}>
      <button
        type="submit"
        disabled={!hydrated || pending}
        aria-label={pending ? "Saindo da conta" : "Sair da conta"}
        aria-describedby={error ? errorId : undefined}
        className={compact ? "icon-button w-auto gap-2 px-3 disabled:opacity-50 sm:flex" : "button-secondary px-4 disabled:opacity-50"}
      >
        <LogOut size={18} aria-hidden="true" />
        <span className={compact ? "hidden sm:inline" : undefined}>{pending ? "Saindo…" : compact ? "Sair" : "Sair da conta"}</span>
      </button>
      {error && (
        <p id={errorId} role="alert" className="absolute right-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-violet/25 bg-card p-3 text-xs leading-5 text-ink shadow-card">
          {error}
        </p>
      )}
    </form>
  );
}
