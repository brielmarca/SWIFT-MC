import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Nova senha | Swift MC" };
export default function ResetPasswordPage() {
  return <AuthCard title="Defina uma nova senha" subtitle="Escolha uma senha única para sua conta Swift MC."><AuthForm mode="reset" /></AuthCard>;
}