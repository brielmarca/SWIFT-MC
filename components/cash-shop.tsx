import { Coins } from "lucide-react";
import { cashPackages } from "@/data/cash-packages";
import { CashPackageCard } from "./cash-package-card";
import { SectionHeading } from "./section-heading";
import { purchasesEnabled } from "@/lib/purchase-gate";

export function CashShop() {
  const testPurchases = purchasesEnabled();
  return (
    <section id="cash" aria-label="Cash Swift MC" className="page-section border-t border-white/10">
      <SectionHeading
        icon={Coins}
        eyebrow="Cash Swift MC"
        title="Mais Cash. Mais possibilidades."
        description="Escolha seu pacote de Cash com 50% de desconto e confira os bônus de cada opção."
      />
      <p className="glass-panel mx-auto mt-6 max-w-2xl px-5 py-4 text-center text-xs leading-5 text-muted">
        {testPurchases ? (process.env.APP_ENV === "production" ? "Pagamento seguro com Stripe. Entrega na conta Minecraft vinculada após confirmação do pagamento." : "Homologação: pagamentos Stripe de teste. E-mail verificado e conta Minecraft vinculada são obrigatórios; entrega na conta vinculada.") : "Compras temporariamente indisponíveis. Confira os pacotes e volte mais tarde."}
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cashPackages.map((pack) => <CashPackageCard key={pack.amount} pack={pack} testPurchases={testPurchases} />)}
      </div>
    </section>
  );
}
