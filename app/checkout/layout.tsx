import type { Metadata } from "next";
import type { ReactNode } from "react";

// Applies only search metadata; checkout and payment behavior is unchanged.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function CheckoutLayout({ children }: { children: ReactNode }) {
  return children;
}
