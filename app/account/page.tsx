import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { User, ShieldCheck, Mail, Clock, Phone, Link2 } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";

export const metadata: Metadata = {
  title: "Minha conta | Swift MC",
  description: "Gerencie sua conta Swift MC: dados pessoais, histórico de pedidos e status de verificação.",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/account");

  const emailVerified = user.emailVerifiedAt !== null;

  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <div>
          <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
            <p className="eyebrow">Sua conta Swift MC</p>
            <h1 className="page-title mt-2">Minha conta</h1>
            <p className="page-description">
              Gerencie seus dados pessoais, verifique seu e-mail e acompanhe seu histórico de pedidos.
            </p>
          </header>

          <section className="grid gap-6 lg:grid-cols-3">
            <section className="glass-panel flex flex-col gap-5 p-5 sm:p-6 lg:col-span-2">
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-full bg-violet/10 p-3">
                  <User size={32} className="text-violet" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink">{user.displayName}</h2>
                  <p className="text-sm text-muted">{user.emailNormalized}</p>
                </div>
              </div>

              <dl className="space-y-4 border-t border-white/10 pt-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck size={18} className="mt-1 shrink-0 text-violet" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Verificação de e-mail</p>
                    <p className={`font-medium ${emailVerified ? "text-ink" : "text-amber-200"}`}>
                      {emailVerified ? "Verificado" : "Não verificado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Endereço de e-mail</p>
                    <p className="font-medium text-ink">{user.emailNormalized}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Telefone</p>
                    <p className="font-medium text-ink">{user.phoneE164 || "Não informado"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                  <div>
                    <p className="micro-label">Conta criada em</p>
                    <p className="font-medium text-ink">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0 text-muted" aria-hidden="true">●</div>
                  <div>
                    <p className="micro-label">Função</p>
                    <p className="font-medium text-ink">{user.role === "USER" ? "Usuário" : user.role}</p>
                  </div>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LogoutButton />
                <Link
                  href="/account/profile"
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                >
                  <User size={18} aria-hidden="true" />
                  <span>Configurações da conta</span>
                </Link>
                <Link
                  href="/account/profile#linked"
                  className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                >
                  <Link2 size={18} aria-hidden="true" />
                  <span>Contas vinculadas</span>
                </Link>
              </div>
            </section>

            <section className="glass-panel flex flex-col gap-5 p-5 sm:p-6 lg:col-span-1">
              <h2 className="text-lg font-bold text-ink">Meus pedidos</h2>
              <p className="text-sm text-muted">
                Acompanhe o status dos seus pedidos na loja Swift MC.
              </p>
              <Link
                href="/account/orders"
                className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Ver histórico de pedidos</span>
              </Link>
            </section>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
