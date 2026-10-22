import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Nova senha | SwiftMC" };
export default function ResetPasswordPage() {
  return <AuthCard title="Defina uma nova senha" subtitle="Escolha uma senha única para sua conta SwiftMC."><AuthForm mode="reset" /></AuthCard>;
}
