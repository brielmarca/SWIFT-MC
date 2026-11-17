import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import Link from "next/link";
import { getTurnstileClientConfig } from "@/lib/auth/turnstile-public-config";

export const metadata = { title: "Criar conta | Swift MC" };
export const dynamic = "force-dynamic";
export default async function RegisterPage() {
  const turnstile = await getTurnstileClientConfig();
  return <AuthCard title="Entre para o Swift MC" subtitle="Receba um link para escolher seu nome e senha e concluir o cadastro."><AuthForm mode="register" turnstile={turnstile} /><Link className="auth-forgot" href="/verify-email">Reenviar email de verificação</Link></AuthCard>;
}
