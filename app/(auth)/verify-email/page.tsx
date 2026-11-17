import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Verificar email | Swift MC", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const valid = typeof params.token === "string" && /^[A-Za-z0-9_-]{43}$/.test(params.token);
  const existing = params.mode === "existing";
  return <AuthCard title="Verifique seu email" subtitle="Confirme o email que recebeu o link. O link expira em 10 minutos.">
    {valid ? <AuthForm mode={existing ? "verify-existing" : "verify"} /> : <p className="auth-message">Link ausente ou inválido. Solicite novas instruções abaixo.</p>}
    <details open={!valid}>
      <summary>Link expirado ou não recebeu o email?</summary>
      <AuthForm mode="resend" />
    </details>
  </AuthCard>;
}
