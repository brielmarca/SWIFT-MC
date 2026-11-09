import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";
import { ProfileForm } from "@/components/account/profile-form";

export const metadata: Metadata = {
  title: "Editar perfil | Swift MC",
  description: "Atualize seu nome de exibição na conta Swift MC.",
};

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/account/profile");

  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <div>
          <Link
            href="/account"
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-lg text-xs font-bold text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar à conta
          </Link>
          <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
            <p className="eyebrow">Sua conta Swift MC</p>
            <h1 className="page-title mt-2">Editar perfil</h1>
            <p className="page-description">
              Atualize seu nome de exibição. Seu endereço de e-mail não pode ser alterado nesta página.
            </p>
          </header>
          <ProfileForm initialDisplayName={user.displayName} initialEmail={user.emailNormalized!} />
        </div>
      </main>
      <Footer />
    </>
  );
}
