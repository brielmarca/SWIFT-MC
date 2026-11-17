import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { PrivacyRequestPanel } from "@/components/account/privacy-request-panel";
import { requireAuthPage } from "@/lib/auth/page-guard";
export const metadata: Metadata = { title: "Solicitações de privacidade | Swift MC", description: "Solicite acesso, correção, exclusão e outros direitos relacionados aos seus dados pessoais.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccountPrivacyPage() {
  await requireAuthPage((await headers()).get("cookie"), "/account/privacy");
  return <><AuthHeader /><main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
    <Link href="/account" className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-ultraviolet underline">Voltar à conta</Link>
    <header className="mb-8 max-w-3xl border-l-2 border-violet pl-5"><p className="eyebrow">Seus direitos</p>
    <h1 className="page-title mt-2">Privacidade e dados pessoais</h1><p className="page-description">Registre uma solicitação autenticada para análise. Este canal não substitui a identificação pública do controlador, que ainda depende de aprovação.</p></header>
    <PrivacyRequestPanel />
  </main><Footer /></>;
}
