import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { PostEditor } from "@/components/admin/post-editor";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Nova publicação | Admin SwiftMC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const admin = await requireAdminPage("content:manage", "/console-r7m4q9v2/posts/new");
  return <AdminShell title="Nova publicação" description="Escreva e salve um rascunho ou publique a notícia imediatamente."
    section="posts" role={admin.role} email={admin.emailNormalized}>
    <Link className="mb-5 inline-block text-sm font-bold text-ultraviolet hover:underline" href="/console-r7m4q9v2/posts">← Voltar para publicações</Link>
    <PostEditor />
  </AdminShell>;
}
