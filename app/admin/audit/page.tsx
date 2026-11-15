import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Auditoria | Admin Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const admin = await requireAdminPage("audit:read", "/admin/audit");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const entries = env.AUTH_HYPERDRIVE ? await getPrisma().authAuditEvent.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 25,
    take: 26,
    select: { id: true, eventType: true, outcome: true, createdAt: true, actorUserId: true, subjectUserId: true },
  }) : null;
  const hasNext = entries !== null && entries.length > 25;
  const events = entries?.slice(0, 25) ?? [];
  return (
    <AdminShell title="Auditoria de segurança" description="Eventos registrados pelo sistema de autenticação e administração. Consulta protegida; dados sensíveis e segredos não são exibidos."
      section="audit" role={admin.role} email={admin.emailNormalized}>
      {entries === null ? <section className="glass-panel p-6" role="status">Banco temporariamente indisponível.</section> : (
        <section className="glass-panel overflow-hidden p-5 sm:p-6">
          <h2 className="mb-5 text-lg font-bold text-ink">Eventos recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[730px] text-left text-sm">
              <thead><tr className="text-xs text-muted">
                <th scope="col" className="pb-3 pr-4">Data e hora</th>
                <th scope="col" className="pb-3 pr-4">Evento</th>
                <th scope="col" className="pb-3 pr-4">Resultado</th>
                <th scope="col" className="pb-3">Contas envolvidas (IDs)</th>
              </tr></thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} className="border-t border-white/10">
                    <td className="whitespace-nowrap py-3 pr-4 text-muted">{new Date(e.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="py-3 pr-4 font-medium text-ink">{e.eventType}</td>
                    <td className={e.outcome === "success" ? "py-3 pr-4 text-emerald-200" : "py-3 pr-4 text-amber-200"}>{e.outcome}</td>
                    <td className="py-3 font-mono text-xs text-muted">{e.actorUserId ?? "sistema"} → {e.subjectUserId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!events.length && <p className="py-5 text-sm text-muted">Nenhum evento nesta página.</p>}
          </div>
          <AdminPagination base="/admin/audit" page={page} hasNext={hasNext} />
        </section>
      )}
    </AdminShell>
  );
}
