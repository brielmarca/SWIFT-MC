import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Package } from "lucide-react";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { requireAuthPage } from "@/lib/auth/page-guard";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import type { AuthBindings } from "@/lib/auth-infrastructure/bindings";

const PAGE_SIZE = 20;

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING_PAYMENT: "Aguardando pagamento",
    PAID: "Pago",
    FULFILLED: "Entregue",
    PAYMENT_FAILED: "Falha no pagamento",
    EXPIRED: "Expirado",
    REFUNDED: "Reembolsado",
    REVIEW_REQUIRED: "Requer revisão",
  };
  return labels[status] || status;
}

function statusVariant(status: string): string {
  const variants: Record<string, string> = {
    PENDING_PAYMENT: "text-amber-200",
    PAID: "text-emerald-200",
    FULFILLED: "text-violet-200",
    PAYMENT_FAILED: "text-rose-200",
    EXPIRED: "text-muted",
    REFUNDED: "text-muted",
    REVIEW_REQUIRED: "text-amber-200",
  };
  return variants[status] || "text-muted";
}

export const metadata: Metadata = {
  title: "Meus pedidos | Swift MC",
  description: "Histórico de pedidos da sua conta Swift MC.",
};

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/account/orders");

  const env = await getWorkersEnv();

  const page = 1;
  const skip = (page - 1) * PAGE_SIZE;

  let orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    rankSlug: string;
    rankName: string;
    rankDuration: string;
    minecraftUsername: string;
    email: string;
    totalCents: number;
    currency: string;
    createdAt: Date;
    expiresAt: Date | null;
    paidAt: Date | null;
  }> = [];
  let total = 0;

  try {
    const result = await withAuthPrisma(env as Pick<AuthBindings, "AUTH_HYPERDRIVE">, async (prisma) => {
      const [dbOrders, dbTotal] = await Promise.all([
        prisma.order.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            rankSlug: true,
            rankName: true,
            rankDuration: true,
            minecraftUsername: true,
            email: true,
            totalCents: true,
            currency: true,
            createdAt: true,
            expiresAt: true,
            paidAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: PAGE_SIZE,
        }),
        prisma.order.count({ where: { userId: user.id } }),
      ]);
      return { dbOrders, dbTotal };
    });

    orders = result.dbOrders;
    total = result.dbTotal;
  } catch {
    orders = [];
    total = 0;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

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
            <h1 className="page-title mt-2">Meus pedidos</h1>
            <p className="page-description">
              Acompanhe o status dos seus pedidos na loja Swift MC.
            </p>
          </header>

          {total === 0 ? (
            <section className="glass-panel p-8 sm:p-12 text-center max-w-3xl mx-auto">
              <Package size={48} className="mx-auto mb-4 text-muted" aria-hidden="true" />
              <h2 className="text-lg font-bold text-ink">Nenhum pedido ainda</h2>
              <p className="mt-2 text-sm text-muted">
                Você ainda não tem pedidos na loja Swift MC.
              </p>
              <Link
                href="/store"
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
              >
                <ShieldCheck size={18} aria-hidden="true" />
                <span>Explorar ranks</span>
              </Link>
            </section>
          ) : (
            <section className="glass-panel p-5 sm:p-6 max-w-3xl mx-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Pedido</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Rank</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Valor</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {orders.map((order) => (
                      <tr key={order.id} className="group">
                        <td className="py-4">
                          <div className="font-mono text-xs text-ink">{order.orderNumber}</div>
                          <div className="mt-1 text-xs text-muted">{order.minecraftUsername}</div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-ink">{order.rankName}</div>
                          <div className="mt-1 text-xs text-muted">{order.rankDuration}</div>
                        </td>
                        <td className="py-4">
                          <div className="text-sm font-bold text-ink">
                            {(order.totalCents / 100).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: order.currency,
                            })}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${statusVariant(order.status)}`}>
                            {statusLabel(order.status)}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="text-sm text-ink">
                            {new Date(order.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-xs text-muted">
                    Exibindo {skip + 1} a {Math.min(skip + PAGE_SIZE, total)} de {total}
                  </div>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <Link
                        href="/account/orders"
                        className="min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                      >
                        Anterior
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link
                        href="/account/orders"
                        className="min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                      >
                        Próximo
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
