"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "swiftmc-cookie-preferences-v1";
const CHANGE_EVENT = "swiftmc-cookie-preferences-changed";
const OPEN_EVENT = "swiftmc-open-cookie-preferences";

export type CookiePreferencesValue = {
  version: 1;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

export function readCookiePreferences(): CookiePreferencesValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const prefs = parsed as Partial<CookiePreferencesValue>;
    if (prefs.version !== 1 || prefs.necessary !== true || typeof prefs.analytics !== "boolean" || typeof prefs.marketing !== "boolean") return null;
    return { version: 1, necessary: true, analytics: prefs.analytics, marketing: prefs.marketing, updatedAt: typeof prefs.updatedAt === "string" ? prefs.updatedAt : "" };
  } catch { return null; }
}

/** Before enabling any future optional analytics/marketing SDK, check this value.
 * Browser-only preference: does not affect required auth and CSRF cookies.
 */
export function hasOptionalCookieConsent(category: "analytics" | "marketing"): boolean {
  return readCookiePreferences()?.[category] === true;
}

export function openCookiePreferences() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CookiePreferences() {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<CookiePreferencesValue | null>(null);
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const loaded = readCookiePreferences();
    setCurrent(loaded);
    setAnalytics(loaded?.analytics ?? false);
    setMarketing(loaded?.marketing ?? false);
    setMounted(true);
    setOpen(!loaded);
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  function save(nextAnalytics: boolean, nextMarketing: boolean) {
    const next: CookiePreferencesValue = {
      version: 1, necessary: true, analytics: nextAnalytics, marketing: nextMarketing, updatedAt: new Date().toISOString(),
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
      setCurrent(next);
      setOpen(false);
      setAnalytics(next.analytics);
      setMarketing(next.marketing);
    } catch {
      // Fail closed: optional integrations remain off if preferences cannot be persisted.
      setAnalytics(false);
      setMarketing(false);
      setCurrent(null);
      setOpen(true);
    }
  }

  if (!mounted) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[95] rounded-full border border-white/20 bg-[#171421] px-4 py-2 text-xs font-semibold text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
        Cookies
      </button>
      {open && (
        <section role="dialog" aria-modal="false" aria-label="Preferências de privacidade e cookies"
          className="fixed bottom-16 left-3 right-3 z-[95] max-h-[75dvh] overflow-y-auto rounded-xl border border-violet/40 bg-[#171421] p-5 text-white shadow-2xl sm:right-auto sm:w-[430px]">
          <h2 className="text-lg font-bold">Sua privacidade na SwiftMC</h2>
          <p className="mt-2 text-sm leading-6 text-white/75">
            Cookies necessários mantêm login e segurança. Estatísticas e publicidade são opcionais, começam desativadas e dependem de consentimento.
          </p>
          <p className="mt-2 text-xs leading-5 text-white/65">
            Atualmente não há integração de rastreamento publicitário ou analítico habilitada nesta versão; suas escolhas ficam salvas apenas neste navegador.
          </p>
          <div className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-3 border-t border-white/15 pt-3">
              <div><p className="text-sm font-semibold">Necessários</p><p className="mt-1 text-xs text-white/65">Sessão, autenticação e proteção CSRF. Sempre ativos.</p></div>
              <span className="text-xs font-semibold text-emerald-200">Obrigatórios</span>
            </div>
            <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-white/15 pt-3">
              <span><span className="block text-sm font-semibold">Estatísticas</span><span className="mt-1 block text-xs text-white/65">Autoriza futuras medições de uso, caso sejam implementadas.</span></span>
              <input type="checkbox" checked={analytics} onChange={e=>setAnalytics(e.target.checked)} className="mt-1 size-5 accent-violet-500" />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 border-t border-white/15 pt-3">
              <span><span className="block text-sm font-semibold">Publicidade</span><span className="mt-1 block text-xs text-white/65">Autoriza futuras tecnologias publicitárias, caso sejam implementadas.</span></span>
              <input type="checkbox" checked={marketing} onChange={e=>setMarketing(e.target.checked)} className="mt-1 size-5 accent-violet-500" />
            </label>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => save(false, false)} className="min-h-11 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10">Rejeitar opcionais</button>
            <button type="button" onClick={() => save(analytics, marketing)} className="min-h-11 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold hover:bg-violet-600">Salvar preferências</button>
          </div>
          <button type="button" onClick={() => save(true, true)} className="mt-2 min-h-11 w-full rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10">Aceitar opcionais</button>
          <p className="mt-3 text-xs leading-5 text-white/65">
            Você pode revogar ou alterar sua escolha a qualquer momento pelo botão Cookies. {current ? "Preferências já registradas neste navegador." : ""}
            {" "}Leia nossa <Link href="/cookies" className="underline underline-offset-2">Política de Cookies</Link> e a <Link href="/privacy" className="underline underline-offset-2">Política de Privacidade</Link>.
          </p>
        </section>
      )}
    </>
  );
}
