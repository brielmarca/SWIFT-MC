import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { CartProvider } from "@/components/cart-provider";
import { ServerStatusProvider } from "@/components/server-status-provider";
import { getServerConfig } from "@/lib/server-status";
import { CheckoutDraftProvider } from "@/components/checkout-draft-provider";
import { SiteAnnouncement } from "@/components/site-announcement";
import { getActiveAnnouncement } from "@/data/content";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "SWIFT MC | Survival Network",
  description:
    "Rede brasileira de Minecraft Survival com economia, protecao de terrenos e uma comunidade ativa.",
};

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
