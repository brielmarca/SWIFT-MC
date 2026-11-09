import type { Metadata } from "next";
import { headers } from "next/headers";
import { CartCheckout } from "@/components/cart-checkout";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";

export const metadata: Metadata = { title: "Checkout | Swift MC", description: "Revise sua seleção. Compras ficam indisponíveis até validação final em homologação.", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/checkout");

  return <><AuthHeader /><main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-16"><header className="mb-8 max-w-3xl"><p className="eyebrow">Revisão da compra</p><h1 className="mt-3 text-4xl font-extrabold uppercase text-ink">Revisar seleção</h1><p className="mt-4 text-base leading-7 text-muted">Confira o VIP selecionado. A finalização da compra permanece desativada até validação final em homologação.</p></header><CartCheckout email={user.emailNormalized ?? ""} verified={user.emailVerifiedAt !== null} /></main><Footer /></>;
}
