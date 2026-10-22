import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Entrar | SwiftMC" };
export default function LoginPage() {
  return <AuthCard title="Bem-vindo de volta" subtitle="Entre na sua conta para continuar no SwiftMC."><AuthForm mode="login" /></AuthCard>;
}
