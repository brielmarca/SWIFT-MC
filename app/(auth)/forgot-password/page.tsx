import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { getTurnstileClientConfig } from "@/lib/auth/turnstile-public-config";

export const metadata = { title: "Recuperar conta | Swift MC" };
export const dynamic = "force-dynamic";
export default async function ForgotPasswordPage() {
  const turnstile = await getTurnstileClientConfig();
  return <AuthCard title="Recupere sua conta" subtitle="Digite seu email para receber as instruções de recuperação."><AuthForm mode="forgot" turnstile={turnstile} /></AuthCard>;
}