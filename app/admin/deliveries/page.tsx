import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Entregas | Admin Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminDeliveriesPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const admin = await requireAdminPage("audit:read", "/admin/deliveries");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const db = env.AUTH_HYPERDRIVE ? getPrisma() : null;
  const [bridge, fulfillment] = db ? await Promise.all([
    db.bridgeDelivery.findMany({ orderBy: [{ createdAt: "desc" }, { deliveryId: "desc" }], skip: (page - 1) * 25, take: 26,
      select: { deliveryId: true, kind: true, action: true, vip: true, cashAmount: true, status: true, playerUuid: true, createdAt: true, ackedAt: true } }),
    db.fulfillment.count({ where: { status: { in: ["PENDING", "PROCESSING", "RETRY_PENDING"] } } }),
  ]) : [null, null];
  const hasNext = bridge !== null && bridge.length > 25;
  const deliveries = bridge?.slice(0, 25) ?? [];
  return (
    <AdminShell title="Entregas Minecraft" description="Acompanhe a fila de VIP e Cash do Bridge e identifique entregas ainda não confirmadas. Nenhum ACK manual é emitido pelo painel."
      section="deliveries" role={admin.role} email={admin.emailNormalized}>
      {bridge === null ? <section className="glass-panel p-6" role="status">Banco temporariamente indisponível.</section> : (
        <div className="space-y-5">
          <section className="glass-panel p-5 sm:p-6">
            <p className="text-sm text-muted">Processamentos da loja pendentes ou em repetição</p>
            <p className="mt-2 text-3xl font-bold text-ink">{fulfillment?.toLocaleString("pt-BR")}</p>
            <p className="mt-2 text-xs text-muted">A fila do Bridge é exibida abaixo e utiliza estados distintos do processamento de pedidos.</p>
          </section>
          <section className="glass-panel overflow-hidden p-5 sm:p-6">
            <h2 className="mb-5 text-lg font-bold text-ink">Fila do Minecraft Bridge</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead><tr className="text-xs text-muted">
                  <th scope="col" className="pb-3 pr-4">Entrega</th>
                  <th scope="col" className="pb-3 pr-4">Tipo</th>
                  <th scope="col" className="pb-3 pr-4">Jogador (UUID)</th>
                  <th scope="col" className="pb-3 pr-4">Estado</th>
                  <th scope="col" className="pb-3">Criado em</th>
                </tr></thead>
                <tbody>
                  {deliveries.map(d => (
                    <tr key={d.deliveryId} className="border-t border-white/10">
                      <td className="max-w-[230px] truncate py-3 pr-4 font-mono text-xs text-ink" title={d.deliveryId}>{d.deliveryId}</td>
                      <td className="py-3 pr-4 font-medium text-ink">{d.kind === "VIP" ? `VIP ${d.vip ?? ""} · ${d.action}` : `Cash ${d.cashAmount} · ${d.action}`}</td>
                      <td className="py-3 pr-4 font-mono text-xs text-muted">{d.playerUuid}</td>
                      <td className={d.status === "ACKED" ? "py-3 pr-4 text-emerald-200" : "py-3 pr-4 text-amber-200"}>{d.status}</td>
                      <td className="py-3 text-muted">{new Date(d.createdAt).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!deliveries.length && <p className="py-5 text-sm text-muted">Nenhuma entrega nesta página.</p>}
            </div>
            <AdminPagination base="/admin/deliveries" page={page} hasNext={hasNext} />
          </section>
        </div>
      )}
    </AdminShell>
  );
}
