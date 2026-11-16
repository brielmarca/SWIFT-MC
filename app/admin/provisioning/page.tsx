import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/prisma";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { ProvisionAdminForm } from "@/components/admin/provision-admin-form";

export const metadata: Metadata = { title: "Provisionamento admin | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProvisioningPage() {
  const user = await requireAdminPage("security:configure", "/console-r7m4q9v2/provisioning");
  const env = await getWorkersEnv();
  const items = env.AUTH_HYPERDRIVE ? await getPrisma().provisionedAdmin.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, discordSubject: true, targetRole: true, claimedAt: true, consumedAt: true, createdAt: true } }) : [];
  return (
    <AdminShell title="Provisionamento de administradores" description="Somente a conta OWNER com MFA pode provisionar administradores, usando o identificador imutável do Discord."
      section="provisioning" role={user.role} email={user.emailNormalized}>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass-panel p-5 sm:p-6"><ProvisionAdminForm /></div>
        <div className="glass-panel p-5 sm:p-6">
          <h2 className="text-lg font-bold text-ink">Allowlist atual</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.length === 0 ? <li className="text-muted">Nenhum registro.</li> : items.map(i => (
              <li key={i.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink">{i.discordSubject}</p>
                  <p className="text-[11px] text-muted">Papel: {i.targetRole}</p>
                </div>
                <span className="text-xs text-muted">{i.claimedAt ? "Reivindicado" : "Pendente"}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </AdminShell>
  );
}
