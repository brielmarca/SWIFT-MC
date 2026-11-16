import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PostEditor, type EditorInitial } from "@/components/admin/post-editor";
import { requireAdminPage } from "@/lib/auth/admin";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Editar publicação | Admin SwiftMC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const admin = await requireAdminPage("content:manage", "/console-r7m4q9v2/posts");
  const { id } = await params;
  if (!/^[a-z0-9]{10,32}$/.test(id)) notFound();
  const post = await getPrisma().contentPost.findUnique({ where: { id },
    select: { id: true, title: true, slug: true, excerpt: true, category: true, tags: true, body: true, status: true, featured: true, revision: true, imageAlt: true, imageMime: true },
  });
  if (!post) notFound();
  const initial: EditorInitial = {
    ...post, category: post.category as EditorInitial["category"],
    status: post.status as EditorInitial["status"], imageAlt: post.imageAlt ?? "",
  };
  return <AdminShell title="Editar publicação" description="Atualize o conteúdo, publique, despublique ou arquive. Todas as alterações são auditadas."
    section="posts" role={admin.role} email={admin.emailNormalized}>
    <Link className="mb-5 inline-block text-sm font-bold text-ultraviolet hover:underline" href="/console-r7m4q9v2/posts">← Voltar para publicações</Link>
    <PostEditor initial={initial} />
  </AdminShell>;
}
