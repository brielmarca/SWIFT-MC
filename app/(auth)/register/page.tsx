import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Criar conta | SwiftMC" };
export default function RegisterPage() {
  return <AuthCard title="Entre para o SwiftMC" subtitle="Seu próximo capítulo começa com você."><AuthForm mode="register" /></AuthCard>;
}
