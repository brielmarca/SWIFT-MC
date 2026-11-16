import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSecurityPanel } from "@/components/admin/admin-security-panel";
import { getOptionalPageSession } from "@/lib/auth/page-guard";
import { hasPermission } from "@/lib/auth/permissions";
import { getMfaState } from "@/lib/auth/mfa-service";

export const metadata: Metadata = { title: "Segurança administrativa | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const cookie = (await headers()).get("cookie");
  const session = await getOptionalPageSession(cookie);
  if (!session) redirect("/login?callbackUrl=/console-r7m4q9v2/security");
  if (session.user.status !== "ACTIVE" || !hasPermission(session.user.role, "audit:read")) redirect("/account");
  // Allow access for admin-capable users to configure MFA even if not yet elevated, but only if MFA not configured or for restricted setup; full elevated actions handled in UI/API.
  const mfa = await getMfaState(session.user.id).catch(() => ({ enabled: false, pending: false, recoveryCodesRemaining: 0 }));
  return (
    <AdminShell title="Segurança administrativa" description="Configure e gerencie a autenticação multifator para acesso administrativo seguro."
      section="security" role={session.user.role} email={session.user.emailNormalized}>
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
    </AdminShell>
  );
}
