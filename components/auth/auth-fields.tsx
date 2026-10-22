"use client";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; error?: string; hint?: ReactNode };

export function AuthField({ label, id, error, hint, children, ...props }: FieldProps) {
  const description = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return <div className="auth-field">
    <label htmlFor={id}>{label}</label>
    <div className="auth-input-wrap"><input {...props} id={id} aria-invalid={!!error} aria-describedby={description} />{children}</div>
    {hint && <div id={`${id}-hint`} className="auth-hint">{hint}</div>}
    {error && <p id={`${id}-error`} className="auth-field-error">{error}</p>}
  </div>;
}

export function PasswordField(props: FieldProps) {
  const [visible, setVisible] = useState(false);
  return <AuthField {...props} type={visible ? "text" : "password"} className="auth-password-input">
    <button className="auth-password-toggle" type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${props.label.toLowerCase()}`} aria-pressed={visible} aria-controls={props.id} onClick={() => setVisible(!visible)}>
      {visible ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
    </button>
  </AuthField>;
}

export function AuthMessage({ tone = "error", children }: { tone?: "error" | "success" | "info"; children: ReactNode }) {
  return <div className={`auth-message auth-message-${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</div>;
}

export function AuthSubmit({ children, disabled, loading = false }: { children: ReactNode; disabled?: boolean; loading?: boolean }) {
  return <button type="submit" className="auth-submit" disabled={disabled || loading} aria-busy={loading}>
    {loading ? <><LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />Aguarde…</> : children}
  </button>;
}
