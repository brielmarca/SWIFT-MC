import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAdminPage } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/prisma";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { ProvisionAdminForm } from "@/components/admin/provision-admin-form";

export const metadata: Metadata = { title: "Provisionamento admin | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminProvisioningPage() {
  await requireAdminPage("/admin/provisioning");
  const env = await getWorkersEnv();
  const items = env.AUTH_HYPERDRIVE ? await getPrisma().provisionedAdmin.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, discordSubject: true, claimedAt: true, createdAt: true } }) : [];
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Área restrita</p>
          <h1 className="page-title mt-2">Provisionamento de administradores</h1>
          <p className="page-description">Somente identificadores Discord (provider subject/ID). Nunca email ou nome de exibição.</p>
        </header>
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="glass-panel p-5 sm:p-6"><ProvisionAdminForm /></div>
          <div className="glass-panel p-5 sm:p-6">
            <h2 className="text-lg font-bold text-ink">Allowlist atual</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {items.length === 0 ? <li className="text-muted">Nenhum registro.</li> : items.map(i => (
                <li key={i.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                  <span className="font-mono text-xs text-ink">{i.discordSubject}</span>
                  <span className="text-xs text-muted">{i.claimedAt ? "Reivindicado" : "Pendente"}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
