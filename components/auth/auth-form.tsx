"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { authAvailability } from "@/lib/auth-ui";
import { AuthField, AuthMessage, AuthSubmit, PasswordField } from "./auth-fields";

export type AuthMode = "login" | "register" | "forgot" | "reset";
const submitLabels = { login: "Entrar", register: "Criar conta", forgot: "Enviar instruções", reset: "Redefinir senha" };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthForm({ mode }: { mode: AuthMode }) {
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [blocked, setBlocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const attempted = useRef(false);
  const newPassword = mode === "register" || mode === "reset";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (attempted.current) return;
    const form = event.currentTarget;
    const email = form.elements.namedItem("email") as HTMLInputElement | null;
    const password = form.elements.namedItem("password") as HTMLInputElement | null;
    const confirmation = form.elements.namedItem("confirmation") as HTMLInputElement | null;
    const nextErrors: Record<string, string> = {};
    if (email && (!email.value.trim() || !email.validity.valid)) nextErrors.email = "Digite um email válido.";
    if (password && !password.value) nextErrors.password = "Digite sua senha.";
    else if (password && newPassword && password.value.length < 12) nextErrors.password = "Use pelo menos 12 caracteres.";
    if (confirmation && (!confirmation.value || confirmation.value !== password?.value)) nextErrors.confirmation = "As senhas precisam ser iguais.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (form.elements.namedItem(Object.keys(nextErrors)[0]) as HTMLInputElement)?.focus();
      return;
    }
    // Fail closed locally. Never send, persist, log, or return credentials.
    attempted.current = true;
    setBlocked(true);
    form.reset();
  }

  return <>
    {mode === "login" && <><button type="button" className="auth-discord" disabled={!ready || blocked} onClick={() => { attempted.current = true; setBlocked(true); }}><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M19.7 5.2a18 18 0 0 0-4.4-1.4l-.6 1.2a16 16 0 0 0-5.4 0l-.6-1.2a18 18 0 0 0-4.4 1.4C1.5 9.3.8 13.3 1.2 17.2a18 18 0 0 0 5.5 2.8l1.1-1.8-1.7-.8.4-.3a13 13 0 0 0 11 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.5-2.8c.5-4.5-.8-8.4-3.1-12ZM8.5 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" /></svg>Continuar com Discord</button><div className="auth-divider"><span>ou</span></div></>}
    <form noValidate onSubmit={submit} onChange={() => { attempted.current = false; setBlocked(false); setErrors({}); }} aria-label={submitLabels[mode]}>
      <fieldset disabled={!ready} className="auth-fields">
        {mode !== "reset" && <AuthField id="email" name="email" label="Email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="voce@exemplo.com" error={errors.email} />}
        {mode !== "forgot" && <PasswordField id="password" name="password" label={mode === "reset" ? "Nova senha" : "Senha"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 12 : undefined} error={errors.password} hint={newPassword ? "Use pelo menos 12 caracteres. Prefira uma frase única, com palavras, números e símbolos." : undefined} />}
        {newPassword && <PasswordField id="confirmation" name="confirmation" label={mode === "reset" ? "Confirmar nova senha" : "Confirmar senha"} autoComplete="new-password" required error={errors.confirmation} />}
        {mode === "login" && <Link className="auth-forgot" href="/forgot-password">Esqueci minha senha</Link>}
        {blocked && <AuthMessage>{authAvailability.message}</AuthMessage>}
        <AuthSubmit disabled={!ready || blocked}>{submitLabels[mode]}</AuthSubmit>
      </fieldset>
      <noscript><p className="auth-message">Autenticação ainda não disponível. Ative JavaScript para explorar o formulário.</p></noscript>
    </form>
    <p className="auth-switch">{mode === "login" ? <>Ainda não tem conta? <Link href="/register">Criar conta</Link></> : mode === "register" ? <>Já tem uma conta? <Link href="/login">Entrar</Link></> : <Link href="/login">Voltar para entrar</Link>}</p>
  </>;
}
