import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { createPageMetadata, SITE_DESCRIPTION } from "@/lib/seo";

export const metadata = createPageMetadata({ title: "Página não encontrada", description: SITE_DESCRIPTION, index: false });

export default function NotFound() {
  return <>
    <SiteHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-8 sm:py-12">
      <div className="feedback-panel">
        <h1 className="page-title">404</h1>
        <h2 lang="en" className="mt-3 text-lg font-extrabold text-ink">This page could not be found.</h2>
      </div>
    </main>
    <Footer />
  </>;
}
