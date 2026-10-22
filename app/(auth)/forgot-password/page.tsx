import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Recuperar conta | SwiftMC" };
export default function ForgotPasswordPage() {
  return <AuthCard title="Recupere sua conta" subtitle="Digite seu email para receber as instruções de recuperação."><AuthForm mode="forgot" /></AuthCard>;
}
