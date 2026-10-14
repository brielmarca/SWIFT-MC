import type { Rank } from "@/data/ranks";
import { CartCheckout } from "./cart-checkout";

// Legacy entry point uses the same local-only preview as /checkout.
export function CheckoutForm({ rank }: { rank: Rank }) {
  return <>
    <p className="mb-6 text-sm leading-6 text-muted">Prévia demo de {rank.name} · {rank.price ?? "Preço em breve"}. Nenhum pedido, pagamento ou benefício real será criado.</p>
    <CartCheckout />
  </>;
}
