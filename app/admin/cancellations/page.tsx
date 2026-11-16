import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Solicitações de cancelamento | SwiftMC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminCancellationsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const admin = await requireAdminPage("audit:read", "/console-r7m4q9v2/cancellations");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const rows = env.AUTH_HYPERDRIVE ? await getPrisma().orderCancellationRequest.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 26,
    skip: (page - 1) * 25,
    select: {
      id: true, status: true, reason: true, createdAt: true,
      order: { select: { orderNumber: true, status: true, rankName: true, totalCents: true, currency: true, email: true, minecraftUsername: true } },
    },
  }) : null;
  const hasNext = rows !== null && rows.length > 25;
  const entries = rows?.slice(0, 25) ?? [];
  return (
    <AdminShell section="cancellations" title="Solicitações de cancelamento"
      description="Pedidos dos clientes aguardando análise. Esta página não executa estornos, não cancela cobranças nem revoga benefícios Minecraft."
      role={admin.role} email={admin.emailNormalized}>
      {rows === null ? (
        <section className="glass-panel p-6" role="status">Banco temporariamente indisponível.</section>
      ) : (
        <section className="glass-panel p-5 sm:p-6">
          <h2 className="mb-3 text-lg font-bold text-ink">Fila de solicitações</h2>
          <p className="mb-5 text-sm leading-6 text-muted">Verifique cada cobrança no provedor de pagamento, o direito aplicável ao consumidor e eventuais benefícios entregues antes de concluir um atendimento. O pedido continua ativo até sua análise.</p>
          <div className="space-y-4">
            {entries.map(e => (
              <article key={e.id} className="rounded-xl border border-white/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="font-mono text-sm font-bold text-ink">{e.order.orderNumber}</h3>
                    <p className="mt-1 text-xs text-muted">{e.order.rankName} · {e.order.minecraftUsername}</p></div>
                  <div className="text-right"><p className="font-bold text-ink">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: e.order.currency }).format(e.order.totalCents / 100)}</p><p className="text-xs text-amber-200">Solicitação: {e.status}</p></div>
                </div>
                <dl className="mt-3 grid gap-2 border-t border-white/10 pt-3 text-xs text-muted sm:grid-cols-2">
                  <div><dt className="font-semibold text-ink">Pedido</dt><dd>{e.order.status}</dd></div>
                  <div><dt className="font-semibold text-ink">Data da solicitação</dt><dd>{new Date(e.createdAt).toLocaleString("pt-BR")}</dd></div>
                  <div><dt className="font-semibold text-ink">E-mail do pedido</dt><dd className="break-all">{e.order.email}</dd></div>
                  <div><dt className="font-semibold text-ink">Motivo</dt><dd className="whitespace-pre-wrap break-words">{e.reason ?? "Não informado"}</dd></div>
                </dl>
              </article>
            ))}
            {!entries.length && <p className="text-sm text-muted">Nenhuma solicitação nesta página.</p>}
          </div>
          <AdminPagination base="/console-r7m4q9v2/cancellations" page={page} hasNext={hasNext} />
        </section>
      )}
    </AdminShell>
  );
}
