import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { AdminMfaLogin } from "@/components/admin/admin-mfa-login";
import { getOptionalPageSession } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getMfaState } from "@/lib/auth/mfa-service";

export const metadata: Metadata = { title: "Login administrativo | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const cookie = (await headers()).get("cookie");
  const session = await getOptionalPageSession(cookie);
  const cb = (await searchParams).callbackUrl;
  const callbackUrl = typeof cb === "string" && cb.startsWith("/admin") ? cb : "/admin";
  if (!session) redirect(`/login?callbackUrl=${encodeURIComponent("/admin/login")}`);
  if (session.user.status !== "ACTIVE" || !hasPermission(session.user.role, "audit:read")) redirect("/account");
  if (session.user.isMfaVerified) redirect(callbackUrl);
  const mfa = await getMfaState(session.user.id).catch(() => ({ enabled: false, pending: false, recoveryCodesRemaining: 0 }));
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Área restrita</p>
          <h1 className="page-title mt-2">Verificação administrativa</h1>
          <p className="page-description">Confirme sua identidade com MFA para elevar a sessão administrativa com segurança.</p>
        </header>
        <section className="glass-panel max-w-xl p-5 sm:p-6">
          <AdminMfaLogin
            callbackUrl={callbackUrl}
            displayName={session.user.displayName}
            mfaEnabled={mfa.enabled}
            pendingSetup={mfa.pending}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
