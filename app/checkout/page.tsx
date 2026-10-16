import type { Metadata } from "next";
import { CartCheckout } from "@/components/cart-checkout";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = { title: "Checkout demo | SWIFT MC", description: "Experimente o checkout local sem pedidos ou pagamentos reais." };

export default function CheckoutPage() {
  return <><SiteHeader /><main id="main-content" className="site-container min-h-[70vh] py-12 sm:py-16"><header className="mb-8 max-w-3xl"><p className="eyebrow">Checkout demonstrativo</p><h1 className="mt-3 text-4xl font-extrabold uppercase text-ink">Revisar seleção</h1><p className="mt-4 text-base leading-7 text-muted">Simulação com os valores mensais oficiais. Nenhuma cobrança, pedido real ou ativação de VIP será realizada.</p></header><CartCheckout /></main><Footer /></>;
}
