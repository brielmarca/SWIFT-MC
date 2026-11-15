import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Pedidos | Admin Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const admin = await requireAdminPage("audit:read", "/admin/orders");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const entries = env.AUTH_HYPERDRIVE ? await getPrisma().order.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 25,
    take: 26,
    select: { id: true, orderNumber: true, status: true, rankName: true, minecraftUsername: true, totalCents: true, currency: true, createdAt: true, paidAt: true },
  }) : null;
  const hasNext = entries !== null && entries.length > 25;
  const orders = entries?.slice(0, 25) ?? [];
  return (
    <AdminShell title="Pedidos da loja" description="Acompanhe os pedidos, status e valores registrados. Nenhuma alteração de pagamento é permitida nesta página."
      section="orders" role={admin.role} email={admin.emailNormalized}>
      {entries === null ? <section className="glass-panel p-6" role="status">Banco temporariamente indisponível.</section> : (
        <section className="glass-panel overflow-hidden p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-lg font-bold text-ink">Pedidos recentes</h2>
            <p className="text-xs text-muted">25 registros por página</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="text-xs text-muted">
                <th scope="col" className="pb-3 pr-4">Pedido</th>
                <th scope="col" className="pb-3 pr-4">Produto</th>
                <th scope="col" className="pb-3 pr-4">Minecraft</th>
                <th scope="col" className="pb-3 pr-4">Valor</th>
                <th scope="col" className="pb-3 pr-4">Status</th>
                <th scope="col" className="pb-3">Criado em</th>
              </tr></thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-t border-white/10">
                    <td className="py-3 pr-4 font-mono text-xs text-ink">{order.orderNumber}</td>
                    <td className="py-3 pr-4 font-medium text-ink">{order.rankName}</td>
                    <td className="py-3 pr-4 text-muted">{order.minecraftUsername}</td>
                    <td className="py-3 pr-4 font-semibold text-ink">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</td>
                    <td className="py-3 pr-4"><span className={order.status === "PAID" || order.status === "FULFILLED" ? "text-emerald-200" : "text-amber-200"}>{order.status}</span></td>
                    <td className="py-3 text-muted">{new Date(order.createdAt).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <p className="py-5 text-sm text-muted">Nenhum pedido nesta página.</p>}
          </div>
          <AdminPagination base="/admin/orders" page={page} hasNext={hasNext} />
        </section>
      )}
    </AdminShell>
  );
}
