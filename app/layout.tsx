import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SiteProviders } from "@/components/site-providers";
import { getServerConfig } from "@/lib/server-status";
import { getActiveAnnouncement } from "@/data/content";
import { rootMetadata, SITE_NAME, SITE_DESCRIPTION, siteUrl } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { CookiePreferences } from "@/components/privacy/cookie-preferences";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = { themeColor: "#090a0f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={jakarta.variable}>
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": siteUrl("/#website"),
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          url: siteUrl("/"),
          inLanguage: "pt-BR",
        }} />
        <SiteProviders publicAddress={getServerConfig().publicAddress} announcement={getActiveAnnouncement()}>
          {children}
        </SiteProviders>
        <CookiePreferences />
      </body>
    </html>
  );
}
