import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Usuários | Admin Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const admin = await requireAdminPage("audit:read", "/admin/users");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const entries = env.AUTH_HYPERDRIVE ? await getPrisma().user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * 25,
    take: 26,
    select: { id: true, displayName: true, emailNormalized: true, role: true, status: true, emailVerifiedAt: true, createdAt: true },
  }) : null;
  const hasNext = entries !== null && entries.length > 25;
  const users = entries?.slice(0, 25) ?? [];
  return (
    <AdminShell title="Usuários" description="Contas reais cadastradas na SwiftMC. Consulta somente leitura; alterações de cargos continuam restritas aos procedimentos autorizados."
      section="users" role={admin.role} email={admin.emailNormalized}>
      {entries === null ? <section className="glass-panel p-6" role="status">Banco temporariamente indisponível.</section> : (
        <section className="glass-panel overflow-hidden p-5 sm:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-lg font-bold text-ink">Contas recentes</h2><p className="text-xs text-muted">25 registros por página</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead><tr className="text-xs text-muted">
                <th scope="col" className="pb-3 pr-4 font-semibold">Conta</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Permissão</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">Situação</th>
                <th scope="col" className="pb-3 pr-4 font-semibold">E-mail</th>
                <th scope="col" className="pb-3 font-semibold">Cadastro</th>
              </tr></thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-t border-white/10">
                    <td className="py-3 pr-4"><p className="font-semibold text-ink">{user.displayName}</p><p className="max-w-[290px] truncate text-xs text-muted">{user.emailNormalized ?? "Sem e-mail"}</p></td>
                    <td className="py-3 pr-4 font-medium text-ink">{user.role}</td>
                    <td className="py-3 pr-4 text-muted">{user.status}</td>
                    <td className="py-3 pr-4">{user.emailVerifiedAt ? <span className="text-emerald-200">Verificado</span> : <span className="text-amber-200">Não verificado</span>}</td>
                    <td className="py-3 text-muted">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <p className="py-5 text-sm text-muted">Nenhum usuário nesta página.</p>}
          </div>
          <AdminPagination base="/admin/users" page={page} hasNext={hasNext} />
        </section>
      )}
    </AdminShell>
  );
}
