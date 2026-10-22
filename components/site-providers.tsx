"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import type { SiteAnnouncement as Announcement } from "@/data/content";
import { isAuthRoute } from "@/lib/auth-ui";
import { CartProvider } from "./cart-provider";
import { CheckoutDraftProvider } from "./checkout-draft-provider";
import { ServerStatusProvider } from "./server-status-provider";
import { SiteAnnouncement } from "./site-announcement";

export function SiteProviders({ children, publicAddress, announcement }: {
  children: ReactNode;
  publicAddress: string;
  announcement: Announcement | null;
}) {
  const pathname = usePathname();
  if (isAuthRoute(pathname ?? "")) return children;
  return (
    <ServerStatusProvider publicAddress={publicAddress}>
      <CartProvider>
        <CheckoutDraftProvider>
          <SiteAnnouncement announcement={announcement} />
          {children}
        </CheckoutDraftProvider>
      </CartProvider>
    </ServerStatusProvider>
  );
}
