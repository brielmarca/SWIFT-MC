import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminPagination, adminPageNumber } from "@/components/admin/admin-pagination";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";
import { PRIVACY_REQUEST_LABELS, type PrivacyRequestKind } from "@/lib/privacy-request-input";
export const metadata: Metadata = { title: "Privacidade: solicitações | SwiftMC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminPrivacyRequestsPage({ searchParams }: { searchParams: Promise<{page?: string|string[]}> }) {
  const admin = await requireAdminPage("audit:read", "/console-r7m4q9v2/privacy");
  const page = await adminPageNumber(searchParams);
  const env = await getWorkersEnv();
  const rows = env.AUTH_HYPERDRIVE ? await getPrisma().privacyRequest.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 26, skip: (page - 1) * 25,
    select: { id: true, kind: true, status: true, details: true, createdAt: true,
      user: { select: { displayName: true, emailNormalized: true } } },
  }) : null;
  return <AdminShell section="privacy" title="Solicitações de privacidade"
    description="Fila de solicitações dos titulares. Esta tela é somente leitura: nunca exporta ou apaga dados automaticamente."
    role={admin.role} email={admin.emailNormalized}>
    {rows === null ? <p className="glass-panel p-6" role="status">Banco temporariamente indisponível.</p> :
      <section className="glass-panel p-5 sm:p-6"><p className="mb-5 text-sm leading-6 text-muted">Antes de responder, valide a identidade, a base legal, eventuais obrigações de retenção e o canal seguro de entrega. Evite copiar informações pessoais para mensagens ou logs.</p>
      <div className="space-y-4">{rows.slice(0, 25).map(row => <article key={row.id} className="rounded-xl border border-white/10 p-4">
        <h2 className="font-semibold text-ink">{PRIVACY_REQUEST_LABELS[row.kind as PrivacyRequestKind] || row.kind}</h2>
        <p className="mt-1 text-xs text-muted">{row.status} · {new Date(row.createdAt).toLocaleString("pt-BR")}</p>
        <p className="mt-2 text-sm text-muted">{row.user.displayName} · {row.user.emailNormalized || "Conta Discord"}</p>
        {row.details && <p className="mt-3 whitespace-pre-wrap break-words border-t border-white/10 pt-3 text-sm text-muted">{row.details}</p>}
      </article>)}{rows.length === 0 && <p className="text-sm text-muted">Nenhuma solicitação registrada.</p>}</div>
      <AdminPagination base="/console-r7m4q9v2/privacy" page={page} hasNext={rows.length > 25} />
      </section>}
  </AdminShell>;
}
