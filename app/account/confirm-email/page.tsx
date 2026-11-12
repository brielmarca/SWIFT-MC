import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { ConfirmEmailForm } from "@/components/account/confirm-email-form";

export const metadata: Metadata = { title: "Confirmar e-mail | Swift MC", robots: { index: false, follow: false } };

export default function ConfirmEmailPage() {
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Conta</p>
          <h1 className="page-title mt-2">Confirmar novo e-mail</h1>
          <p className="page-description">Confirme o link recebido. Contas Discord sem senha podem confirmar com uma sessão autenticada recentemente.</p>
        </header>
        <section className="glass-panel p-5 sm:p-6 max-w-xl">
          <ConfirmEmailForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
