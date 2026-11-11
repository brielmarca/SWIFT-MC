"use client";

import Link from "next/link";
import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { authAvailability } from "@/lib/auth-ui";
import { extractCsrfTokenFromCookie } from "@/lib/auth-client";
import { AuthField, AuthMessage, AuthSubmit, PasswordField } from "./auth-fields";
import { DiscordAuthButton } from "./discord-auth-button";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify" | "verify-existing" | "resend";
const submitLabels = { login: "Entrar", register: "Criar conta", forgot: "Enviar instruções", reset: "Redefinir senha", verify: "Concluir cadastro", "verify-existing": "Verificar email", resend: "Reenviar verificação" };

const endpointForMode: Record<AuthMode, string> = {
  login: "/api/login",
  register: "/api/register",
  forgot: "/api/password-reset/request",
  reset: "/api/password-reset/complete",
  verify: "/api/verify-email",
  "verify-existing": "/api/verify-email",
  resend: "/api/auth/resend-verification",
};

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function AuthForm({ mode, returnPath = "/" }: { mode: AuthMode; returnPath?: string }) {
  const fieldId = useId();
  // Server HTML and the first hydration render keep credentials disabled.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [acknowledgement, setAcknowledgement] = useState<string | null>(null);
  const attempted = useRef(false);
  const newPassword = mode === "verify" || mode === "reset";
  const needsPassword = mode === "login" || newPassword;
  const verification = mode === "verify" || mode === "verify-existing";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || attempted.current || submitting) return;
    setServerError(null);
    setAcknowledgement(null);
    setErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = ((formData.get("email") as string) || "").trim();
    const displayName = ((formData.get("displayName") as string) || "").trim();
    const password = (formData.get("password") as string) || "";
    const confirmation = (formData.get("confirmation") as string) || "";

    const nextErrors: Record<string, string> = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = "Digite um email válido.";
    if (mode === "verify" && !displayName) nextErrors.displayName = "Digite seu nome de exibição.";
    if (needsPassword) {
      if (!password) nextErrors.password = "Digite sua senha.";
      else if (newPassword && password.length < 12) nextErrors.password = "Use pelo menos 12 caracteres.";
    }
    if (newPassword && (!confirmation || confirmation !== password)) nextErrors.confirmation = "As senhas precisam ser iguais.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      (form.elements.namedItem(Object.keys(nextErrors)[0]) as HTMLInputElement)?.focus();
      return;
    }

    // Reset emails contain a token, not an email address. The visible email
    // field supplies the identity; the server enforces the challenge binding.
    const challengeToken = mode === "reset" || verification ? new URLSearchParams(window.location.search).get("token") : null;
    if (verification && (!challengeToken || !/^[A-Za-z0-9_-]{43}$/.test(challengeToken))) {
      setServerError("Link de verificação inválido. Solicite um novo email abaixo.");
      return;
    }
    if (mode === "reset" && (!challengeToken || !/^[A-Za-z0-9_-]{43}$/.test(challengeToken))) {
      setServerError("Link de redefinição inválido. Solicite novas instruções.");
      return;
    }

    attempted.current = true;
    setSubmitting(true);

    try {
      const body = mode === "forgot" || mode === "register" || mode === "resend" ? { email }
        : mode === "reset" ? { email, newPassword: password, challengeToken }
        : mode === "verify" ? { email, password, displayName, challengeToken }
        : mode === "verify-existing" ? { email, challengeToken }
        : { email, password };

      // Read CSRF token from cookie and send as header
      const csrfToken = extractCsrfTokenFromCookie();

      const response = await fetch(endpointForMode[mode], {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify(body),
      });

      // Session cookies are managed exclusively by the browser's HTTP layer.
      if (response.ok) {
        const result = await response.json();
        if (mode === "login" || mode === "verify") {
          if (mode === "verify") form.reset();
          window.location.href = mode === "login" ? returnPath : "/";
        } else if (mode === "forgot" || mode === "register" || mode === "resend") {
          setAcknowledgement(result.acknowledgement ?? "Se for possível, enviaremos as instruções para o email informado.");
        } else if (mode === "reset" || mode === "verify-existing") {
          window.location.href = "/login";
        }
        return;
      }

      let errorData: { error?: { code?: string; message?: string } } = {};
      try {
        errorData = await response.json();
      } catch {
        // Ignore parse errors; use generic message.
      }
      const message =
        errorData.error?.message ||
        (mode === "login" ? "Email ou senha inválidos." : "Não foi possível concluir a solicitação.");
      setServerError(message);
    } catch {
      setServerError("Não foi possível concluir a solicitação.");
    } finally {
      attempted.current = false;
      setSubmitting(false);
    }
  }

  return <>
    {(mode === "login" || mode === "register") && <DiscordAuthButton returnPath={returnPath} label={mode === "login" ? "Entrar com Discord" : "Cadastrar com Discord"} />}
    {(mode === "login" || mode === "register") && <div className="auth-divider"><span>ou</span></div>}
    <form method="post" action={endpointForMode[mode]} noValidate onSubmit={submit} onChange={() => { setErrors({}); setServerError(null); setAcknowledgement(null); }} aria-label={submitLabels[mode]}>
      <fieldset disabled={!hydrated || submitting} className="auth-fields">
        <AuthField id={`${fieldId}-email`} name="email" label="Email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="voce@exemplo.com" error={errors.email} />
        {mode === "verify" && <AuthField id="displayName" name="displayName" label="Nome de exibição" autoComplete="nickname" required maxLength={100} error={errors.displayName} />}
        {needsPassword && <PasswordField id="password" name="password" label={mode === "reset" ? "Nova senha" : "Senha"} autoComplete={newPassword ? "new-password" : "current-password"} required minLength={newPassword ? 12 : undefined} error={errors.password} hint={newPassword ? "Use pelo menos 12 caracteres. Prefira uma frase única, com palavras, números e símbolos." : undefined} />}
        {newPassword && <PasswordField id="confirmation" name="confirmation" label={mode === "reset" ? "Confirmar nova senha" : "Confirmar senha"} autoComplete="new-password" required error={errors.confirmation} />}
        {mode === "login" && <Link className="auth-forgot" href="/forgot-password">Esqueci minha senha</Link>}
        {serverError && <AuthMessage>{serverError}</AuthMessage>}
        {acknowledgement && <AuthMessage tone="success">{acknowledgement}</AuthMessage>}
        {authAvailability.message && <AuthMessage>{authAvailability.message}</AuthMessage>}
        <AuthSubmit disabled={!hydrated || submitting} loading={submitting}>{submitLabels[mode]}</AuthSubmit>
      </fieldset>
      <noscript><p className="auth-message">Ative JavaScript para usar o formulário de autenticação.</p></noscript>
    </form>
    <p className="auth-switch">{mode === "login" ? <>Ainda não tem conta? <Link href="/register">Criar conta</Link></> : mode === "register" ? <>Já tem uma conta? <Link href="/login">Entrar</Link></> : <Link href="/login">Voltar para entrar</Link>}</p>
  </>;
}
