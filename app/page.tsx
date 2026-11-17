import { FeatureGrid } from "@/components/feature-grid";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { NewsTeaser } from "@/components/news-teaser";
import { NetworkMetrics } from "@/components/network-metrics";
import { AuthHeader } from "@/components/auth-header";
import { StoreSection } from "@/components/store-section";
import { publicPageMetadata } from "@/lib/seo";

export const metadata = publicPageMetadata("/");

export default function Home() {
  return (
    <>
      <AuthHeader />
      <main id="main-content">
        <Hero />
        <NetworkMetrics />
        <StoreSection />
        <FeatureGrid />
        <NewsTeaser />
      </main>
      <Footer />
    </>
  );
}
