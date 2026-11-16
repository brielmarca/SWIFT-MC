import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/prisma";
import { getWorkersEnv } from "@/lib/auth-api/get-env";

export const metadata: Metadata = { title: "Painel administrativo | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function loadData() {
  const env = await getWorkersEnv();
  if (!env.AUTH_HYPERDRIVE) return null;
  const prisma = getPrisma();
  const [users, orders, approvedOrders, fulfillmentsPending, bridgePending, activeVips, cancellationOpen, recentOrders, recentAudit] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["PAID", "FULFILLED"] } } }),
    prisma.fulfillment.count({ where: { status: { in: ["PENDING", "PROCESSING", "RETRY_PENDING"] } } }),
    prisma.bridgeDelivery.count({ where: { status: "PENDING" } }),
    prisma.vipEntitlement.count({ where: { status: "ACTIVE", revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.orderCancellationRequest.count({ where: { status: "OPEN" } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, orderNumber: true, rankName: true, status: true, totalCents: true, currency: true, createdAt: true } }),
    prisma.authAuditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, eventType: true, outcome: true, createdAt: true } }),
  ]);
  return { users, orders, approvedOrders, fulfillmentsPending, bridgePending, activeVips, cancellationOpen, recentOrders, recentAudit };
}

export default async function AdminPage() {
  const user = await requireAdminPage("audit:read", "/console-r7m4q9v2");
  const data = await loadData();
  const cards = data ? [
    { label: "Usuários cadastrados", value: data.users, href: "/admin/users" },
    { label: "Pedidos registrados", value: data.orders, href: "/admin/orders" },
    { label: "Pedidos pagos ou entregues", value: data.approvedOrders, href: "/admin/orders" },
    { label: "VIPs ativos", value: data.activeVips, href: "/admin/deliveries" },
    { label: "Processamentos pendentes", value: data.fulfillmentsPending, href: "/admin/deliveries" },
    { label: "Entregas Bridge pendentes", value: data.bridgePending, href: "/admin/deliveries" },
    { label: "Cancelamentos solicitados", value: data.cancellationOpen, href: "/admin/cancellations" },
  ] : [];

  return (
<<<<<<< HEAD
    <AdminShell title="Painel administrativo" description="Acompanhe a operação da loja e do servidor com dados reais do banco. Os controles de acesso e MFA continuam obrigatórios."
      section="overview" role={user.role} email={user.emailNormalized}>
      {!data ? (
        <section className="glass-panel p-6" role="status">Dados administrativos temporariamente indisponíveis.</section>
      ) : (
        <div className="space-y-6">
          <section aria-label="Indicadores operacionais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(card => (
              <Link href={card.href} key={card.label} className="glass-panel block rounded-xl p-5 transition-colors hover:border-violet/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                <p className="text-sm text-muted">{card.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-ink">{card.value.toLocaleString("pt-BR")}</p>
                <p className="mt-3 text-xs font-semibold text-ultraviolet">Abrir seção →</p>
              </Link>
            ))}
          </section>
          <p className="text-xs text-muted">Indicadores refletem o estado atual do banco. Pedidos pagos/entregues não equivalem a receita líquida ou saldo financeiro.</p>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="glass-panel overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">Pedidos recentes</h2>
                <Link href="/admin/orders" className="text-sm font-semibold text-ultraviolet">Ver todos</Link>
              </div>
              <div className="mt-4 space-y-3">
                {data.recentOrders.map(order => (
                  <div key={order.id} className="flex items-start justify-between gap-3 border-t border-white/10 pt-3 text-sm">
                    <div className="min-w-0"><p className="font-medium text-ink">{order.orderNumber}</p><p className="truncate text-xs text-muted">{order.rankName} · {new Date(order.createdAt).toLocaleString("pt-BR")}</p></div>
                    <div className="shrink-0 text-right"><p className="font-semibold text-ink">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: order.currency }).format(order.totalCents / 100)}</p><p className="text-xs text-muted">{order.status}</p></div>
                  </div>
                ))}
                {!data.recentOrders.length && <p className="text-sm text-muted">Nenhum pedido registrado.</p>}
              </div>
            </section>
            <section className="glass-panel overflow-hidden p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-ink">Auditoria recente</h2>
                <Link href="/admin/audit" className="text-sm font-semibold text-ultraviolet">Ver eventos</Link>
              </div>
              <div className="mt-4 space-y-3">
                {data.recentAudit.map(event => (
                  <div key={event.id} className="flex items-start justify-between gap-3 border-t border-white/10 pt-3 text-sm">
                    <div className="min-w-0"><p className="break-words font-medium text-ink">{event.eventType}</p><p className="text-xs text-muted">{new Date(event.createdAt).toLocaleString("pt-BR")}</p></div>
                    <span className={event.outcome === "success" ? "text-xs font-semibold text-emerald-200" : "text-xs font-semibold text-amber-200"}>{event.outcome}</span>
                  </div>
                ))}
                {!data.recentAudit.length && <p className="text-sm text-muted">Sem eventos recentes.</p>}
              </div>
            </section>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
