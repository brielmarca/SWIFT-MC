import type { Metadata } from "next";
import { headers } from "next/headers";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";
import { MfaSetupForm } from "@/components/auth/mfa-setup-form";

export const metadata: Metadata = { title: "Segurança | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const cookie = (await headers()).get("cookie");
  const user = await requireAuthPage(cookie, "/security");
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Conta</p>
          <h1 className="page-title mt-2">Segurança</h1>
          <p className="page-description">Autenticação em dois fatores (MFA) para proteger contas administrativas.</p>
        </header>
        <section className="glass-panel p-5 sm:p-6 max-w-2xl">
          <MfaSetupForm displayName={user.displayName} />
        </section>
      </main>
      <Footer />
    </>
  );
}
