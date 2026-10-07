import { CommunityBanner } from "@/components/community-banner";
import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { NewsTeaser } from "@/components/news-teaser";
import { NetworkMetrics } from "@/components/network-metrics";
import { SiteHeader } from "@/components/site-header";
import { StoreSection } from "@/components/store-section";
import { SystemsBanner } from "@/components/systems-banner";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero />
        <NetworkMetrics />
        <StoreSection />
        <FeatureGrid />
        <SystemsBanner />
        <NewsTeaser />
        <CommunityBanner />
      </main>
      <Footer />
    </>
  );
}
