import type { Metadata } from "next";
import { headers } from "next/headers";
import { CartCheckout } from "@/components/cart-checkout";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";
import { purchasesEnabled } from "@/lib/purchase-gate";
import { cashPackages } from "@/data/cash-packages";
import { TestPurchaseButton } from "@/components/test-purchase-button";

export const metadata: Metadata = { title: "Checkout | Swift MC", description: "Revise sua seleção. Compras ficam indisponíveis até validação final em homologação.", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cash?: string }> }) {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/checkout");
  const { cash } = await searchParams;
  const pack = cashPackages.find(pack => String(pack.amount) === cash);
  const testPurchases = purchasesEnabled();

  return <>
    <AuthHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-16">
      <header className="mb-8 max-w-3xl">
        <p className="eyebrow">Revisão da compra</p>
        <h1 className="mt-3 text-4xl font-extrabold uppercase text-ink">Revisar seleção</h1>
        <p className="mt-4 text-base leading-7 text-muted">{testPurchases
          ? "Homologação: use apenas cartões de teste Stripe e o servidor Minecraft de staging."
          : "Confira o VIP selecionado. A finalização da compra permanece desativada até validação final em homologação."}</p>
      </header>
      {pack && testPurchases ? <section className="glass-panel space-y-4 p-6">
        <h2>{pack.amount + pack.bonus} Cash · {(pack.price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</h2>
        <TestPurchaseButton slug={`cash-${pack.amount}`} type="cash" disabled={!user.emailVerifiedAt} />
      </section> : <CartCheckout email={user.emailNormalized ?? ""} verified={user.emailVerifiedAt !== null} testPurchases={testPurchases} />}
    </main>
    <Footer />
  </>;
}
