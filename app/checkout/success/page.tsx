import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { DemoCheckoutSuccess } from "@/components/demo-checkout-success";

export const metadata: Metadata = { title: "Demonstração concluída | SWIFT MC", robots: { index: false, follow: false } };

export default function CheckoutSuccessPage() {
  return <><SiteHeader /><main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-20"><DemoCheckoutSuccess /></main><Footer /></>;
}
