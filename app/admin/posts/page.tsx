import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/lib/auth/admin";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Publicações | Admin SwiftMC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const statusText: Record<string, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicada", ARCHIVED: "Arquivada" };
export default async function AdminPostsPage() {
  const admin = await requireAdminPage("content:manage", "/console-r7m4q9v2/posts");
  const env = await getWorkersEnv();
  const posts = env.AUTH_HYPERDRIVE
    ? await getPrisma().contentPost.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 100,
      select: { id: true, title: true, category: true, status: true, slug: true, updatedAt: true, publishedAt: true },
    })
    : null;
  return (
    <AdminShell title="Publicações" description="Crie notícias, patch notes e avisos. Rascunhos não aparecem no site até a publicação."
      section="posts" role={admin.role} email={admin.emailNormalized}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-muted">Conteúdo oficial da SwiftMC · até 100 publicações recentes</p>
        <Link href="/console-r7m4q9v2/posts/new" className="button-primary">+ Nova publicação</Link>
      </div>
      {!posts ? <section className="glass-panel p-6" role="status">Banco de dados indisponível.</section> :
        <section className="glass-panel overflow-hidden p-5 sm:p-6">
          {posts.length ? <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] text-left text-sm">
              <thead><tr className="border-b border-white/10 text-muted">
                <th className="pb-3 pr-4" scope="col">Título</th><th className="pb-3 pr-4" scope="col">Tipo</th><th className="pb-3 pr-4" scope="col">Situação</th><th className="pb-3 pr-4" scope="col">Alterada em</th><th className="pb-3" scope="col">Ação</th>
              </tr></thead>
              <tbody>{posts.map(post => <tr key={post.id} className="border-b border-white/10 last:border-b-0">
                <td className="py-4 pr-4 font-semibold text-ink"><span className="block max-w-sm truncate">{post.title}</span><span className="text-xs font-normal text-muted">/news/{post.slug}</span></td>
                <td className="py-4 pr-4 text-muted">{post.category}</td>
                <td className="py-4 pr-4"><span className={post.status === "PUBLISHED" ? "text-emerald-200" : "text-amber-200"}>{statusText[post.status] ?? post.status}</span></td>
                <td className="py-4 pr-4 text-muted">{post.updatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td className="py-4"><Link className="font-bold text-ultraviolet hover:underline" href={`/console-r7m4q9v2/posts/${post.id}`}>Editar</Link></td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="py-6 text-center text-sm text-muted">Ainda não existem publicações. Clique em “Nova publicação” para começar.</p>}
        </section>}
    </AdminShell>
  );
}
