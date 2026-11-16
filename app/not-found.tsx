import Link from "next/link";
import { Footer } from "@/components/footer";
import { AuthHeader } from "@/components/auth-header";
import { createPageMetadata, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata = createPageMetadata({ title: "Página não encontrada", description: SITE_DESCRIPTION, index: false });

export default function NotFound() {
  return <>
    <AuthHeader />
    <main id="main-content" className="site-container flex min-h-[70vh] items-center justify-center px-4 py-10 sm:py-16">
      <section className="glass-panel mx-auto w-full max-w-xl p-7 text-center sm:p-12">
        <p className="text-6xl font-black tracking-tight text-ultraviolet sm:text-7xl">404</p>
        <h1 className="mt-4 text-2xl font-extrabold text-ink sm:text-3xl">Página não encontrada</h1>
        <p className="mt-4 text-sm leading-6 text-muted">O endereço pode ter mudado ou não existir mais. Volte ao início ou confira as notícias e a loja da SwiftMC.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="button-primary">Página inicial</Link>
          <Link href="/store" className="button-secondary">Explorar VIPs</Link>
          <Link href="/news" className="button-secondary">Notícias</Link>
        </div>
      </section>
    </main>
    <Footer />
  </>;
}
