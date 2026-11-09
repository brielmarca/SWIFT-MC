import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import Link from "next/link";

export const metadata = { title: "Criar conta | Swift MC" };
export default function RegisterPage() {
  return <AuthCard title="Entre para o Swift MC" subtitle="Receba um link para escolher seu nome e senha e concluir o cadastro."><AuthForm mode="register" /><Link className="auth-forgot" href="/verify-email">Reenviar email de verificação</Link></AuthCard>;
}
