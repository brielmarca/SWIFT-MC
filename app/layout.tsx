import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { ServerStatusProvider } from "@/components/server-status-provider";
import { getServerConfig } from "@/lib/server-status";
import { CheckoutDraftProvider } from "@/components/checkout-draft-provider";
import { SiteAnnouncement } from "@/components/site-announcement";
import { getActiveAnnouncement } from "@/data/content";
import { rootMetadata } from "@/lib/seo";
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
        <ServerStatusProvider publicAddress={getServerConfig().publicAddress}>
          <CartProvider>
            <CheckoutDraftProvider>
              <SiteAnnouncement announcement={getActiveAnnouncement()} />
              {children}
            </CheckoutDraftProvider>
          </CartProvider>
        </ServerStatusProvider>
      </body>
    </html>
  );
}
