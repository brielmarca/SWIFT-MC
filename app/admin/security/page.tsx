import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";
import { getOptionalPageSession } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getMfaState } from "@/lib/auth/mfa-service";

export const metadata: Metadata = { title: "Segurança administrativa | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const cookie = (await headers()).get("cookie");
  const session = await getOptionalPageSession(cookie);
  if (!session) redirect("/login?callbackUrl=/admin/security");
  if (session.user.status !== "ACTIVE" || !hasPermission(session.user.role, "audit:read")) redirect("/account");
  // Allow access for admin-capable users to configure MFA even if not yet elevated, but only if MFA not configured or for restricted setup; full elevated actions handled in UI/API.
  const mfa = await getMfaState(session.user.id).catch(() => ({ enabled: false, pending: false, recoveryCodesRemaining: 0 }));
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Área restrita</p>
          <h1 className="page-title mt-2">Segurança administrativa</h1>
          <p className="page-description">Configure e gerencie MFA para acesso administrativo seguro.</p>
        </header>
        <section className="glass-panel max-w-2xl p-5 sm:p-6">
          <AdminSecurityPanel
            displayName={session.user.displayName}
            email={session.user.emailNormalized}
            mfaEnabled={mfa.enabled}
            pendingSetup={mfa.pending}
            recoveryCodesRemaining={mfa.recoveryCodesRemaining}
            mfaVerified={session.user.isMfaVerified}
            canProvision={hasPermission(session.user.role, "security:configure")}
          />
        </section>
      </main>
      <Footer />
    </>
  );
}
