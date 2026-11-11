import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAdminPage } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/prisma";
import { getWorkersEnv } from "@/lib/auth-api/get-env";

export const metadata: Metadata = { title: "Admin | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function loadData() {
  const env = await getWorkersEnv();
  if (!env.AUTH_HYPERDRIVE) return null;
  const prisma = getPrisma();
  const [users, orders, paidOrders, fulfillmentsPending, provisioned, audit] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.fulfillment.count({ where: { status: { in: ["PENDING", "PROCESSING", "RETRY_PENDING"] } } }),
    prisma.provisionedAdmin.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, discordSubject: true, claimedAt: true, createdAt: true } }),
    prisma.authAuditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, eventType: true, outcome: true, createdAt: true } }),
  ]);
  return { users, orders, paidOrders, fulfillmentsPending, provisioned, audit };
}

export default async function AdminPage() {
  await requireAdminPage("/admin");
  const data = await loadData();
  return (
    <>
      <AuthHeader />
      <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
        <header className="mb-6 max-w-3xl border-l-2 border-violet pl-4 sm:mb-8 sm:pl-5">
          <p className="eyebrow">Área restrita</p>
          <h1 className="page-title mt-2">Painel administrativo</h1>
          <p className="page-description">Dados reais do sistema. Acesso limitado a contas administrativas ativas.</p>
        </header>
        {!data ? (
          <section className="glass-panel p-5 sm:p-6"><p className="text-muted">Infraestrutura de autenticação/banco indisponível.</p></section>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="glass-panel p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Resumo</h2>
              <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-muted">Usuários</dt><dd className="font-semibold text-ink">{data.users}</dd></div>
                <div><dt className="text-muted">Pedidos</dt><dd className="font-semibold text-ink">{data.orders}</dd></div>
                <div><dt className="text-muted">Pedidos pagos</dt><dd className="font-semibold text-ink">{data.paidOrders}</dd></div>
                <div><dt className="text-muted">Entregas pendentes</dt><dd className="font-semibold text-ink">{data.fulfillmentsPending}</dd></div>
              </dl>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/security" className="button-secondary px-4">Segurança/MFA</Link>
                <Link href="/admin/provisioning" className="button-secondary px-4">Provisionamento admin</Link>
              </div>
            </section>
            <section className="glass-panel p-5 sm:p-6">
              <h2 className="text-lg font-bold text-ink">Admins provisionados (Discord)</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {data.provisioned.length === 0 ? <li className="text-muted">Nenhum registro.</li> : data.provisioned.map(p => (
                  <li key={p.id} className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
                    <span className="font-mono text-xs text-ink">{p.discordSubject}</span>
                    <span className="text-xs text-muted">{p.claimedAt ? "Reivindicado" : "Pendente"}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="glass-panel p-5 sm:p-6 lg:col-span-2">
              <h2 className="text-lg font-bold text-ink">Auditoria recente</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead><tr className="text-muted"><th className="py-2 pr-3">Quando</th><th className="py-2 pr-3">Evento</th><th className="py-2 pr-3">Resultado</th></tr></thead>
                  <tbody>
                    {data.audit.map(a => (
                      <tr key={a.id} className="border-t border-white/10"><td className="py-2 pr-3 text-muted">{new Date(a.createdAt).toLocaleString("pt-BR")}</td><td className="py-2 pr-3 text-ink">{a.eventType}</td><td className="py-2 pr-3 text-muted">{a.outcome}</td></tr>
                    ))}
                    {data.audit.length === 0 && <tr><td colSpan={3} className="py-3 text-muted">Sem eventos.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
