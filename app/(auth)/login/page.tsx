import { AuthCard } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { internalReturnPath } from "@/lib/auth/browser-security";
import { getTurnstileClientConfig } from "@/lib/auth/turnstile-public-config";

export const metadata = { title: "Entrar | Swift MC" };
export const dynamic = "force-dynamic";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const { callbackUrl } = await searchParams;
  const returnPath = typeof callbackUrl === "string" ? internalReturnPath(callbackUrl) ?? "/" : "/";
  const turnstile = await getTurnstileClientConfig();
  return <AuthCard title="Bem-vindo de volta" subtitle="Entre na sua conta para continuar na Swift MC."><AuthForm mode="login" returnPath={returnPath} turnstile={turnstile} /></AuthCard>;
}
