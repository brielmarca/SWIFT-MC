import { CommunityCTA } from "@/components/community-cta";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { NewsTeaser } from "@/components/news-teaser";
import { NetworkMetrics } from "@/components/network-metrics";
import { SiteHeader } from "@/components/site-header";
import { StoreSection } from "@/components/store-section";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("/");

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <NetworkMetrics />
        <StoreSection />
        <FeatureGrid />
        <NewsTeaser />
        <CommunityCTA />
      </main>
      <Footer />
    </>
  );
}
