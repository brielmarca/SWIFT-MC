import type { Metadata } from "next";
import { headers } from "next/headers";
import { CartCheckout } from "@/components/cart-checkout";
import { AuthHeader } from "@/components/auth-header";
import { Footer } from "@/components/footer";
import { requireAuthPage } from "@/lib/auth/page-guard";
import { purchasesEnabled } from "@/lib/purchase-gate";
import { cashPackages } from "@/data/cash-packages";
import { TestPurchaseButton } from "@/components/test-purchase-button";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { getLinkedMinecraftIdentityForUser } from "@/lib/minecraft-bridge/purchase";
import Link from "next/link";

export const metadata: Metadata = { title: "Checkout | Swift MC", description: "Revise sua seleção e pague com segurança pelo Stripe.", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cash?: string }> }) {
  const cookieHeader = (await headers()).get("cookie");
  const user = await requireAuthPage(cookieHeader, "/checkout");
  const { cash } = await searchParams;
  const pack = cashPackages.find(pack => String(pack.amount) === cash);
  const testPurchases = purchasesEnabled();
  const linked = testPurchases && await withAuthPrisma(await getWorkersEnv(), db => getLinkedMinecraftIdentityForUser(db, user.id));
  const eligible = !!user.emailVerifiedAt && !!linked;

  return <>
    <AuthHeader />
    <main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-16">
      <header className="mb-8 max-w-3xl">
        <p className="eyebrow">Revisão da compra</p>
        <h1 className="mt-3 text-4xl font-extrabold uppercase text-ink">Revisar seleção</h1>
        <p className="mt-4 text-base leading-7 text-muted">{testPurchases
          ? (process.env.APP_ENV === "production" ? "Pagamento seguro com Stripe. Entrega na conta Minecraft vinculada após confirmação do pagamento." : "Homologação: use apenas cartões de teste Stripe e o servidor Minecraft de staging.")
          : "Compras temporariamente indisponíveis. Sua seleção permanece salva."}</p>
      </header>
      {testPurchases && !eligible && <p className="mb-6 text-sm text-muted">Verifique seu email e vincule sua conta Minecraft em <Link href="/account" className="underline">Minha conta</Link> para continuar.</p>}
      {pack && testPurchases ? <section className="glass-panel space-y-4 p-6">
        <h2>{pack.amount + pack.bonus} Cash · {(pack.price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</h2>
        <TestPurchaseButton slug={`cash-${pack.amount}`} type="cash" disabled={!eligible} />
      </section> : <CartCheckout email={user.emailNormalized ?? ""} verified={eligible} testPurchases={testPurchases} />}
    </main>
    <Footer />
  </>;
}
