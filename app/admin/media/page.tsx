import type { Metadata } from "next";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { MediaUpload } from "@/components/admin/media-upload";
import { requireAdminPage } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Imagens | Swift MC", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MediaAdminPage() {
  await requireAdminPage("audit:read", "/console-r7m4q9v2/media");
  return <>
    <AuthHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <header className="mb-6 border-l-2 border-violet pl-4">
        <p className="eyebrow">Área restrita</p>
        <h1 className="page-title mt-2">Imagens de publicações</h1>
        <p className="page-description">Faça o upload e copie a URL para usar em notícias, atualizações e patch notes.</p>
      </header>
      <section className="glass-panel max-w-3xl p-6"><MediaUpload /></section>
    </main>
    <Footer />
  </>;
}
