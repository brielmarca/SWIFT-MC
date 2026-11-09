import { Coins } from "lucide-react";
import { cashPackages } from "@/data/cash-packages";
import { CashPackageCard } from "./cash-package-card";
import { SectionHeading } from "./section-heading";

export function CashShop() {
  return (
    <section id="cash" aria-label="Cash Swift MC" className="page-section border-t border-white/10">
      <SectionHeading
        icon={Coins}
        eyebrow="Cash Swift MC"
        title="Mais Cash. Mais possibilidades."
        description="Escolha seu pacote de Cash com 50% de desconto e confira os bônus de cada opção."
      />
      <p className="glass-panel mx-auto mt-6 max-w-2xl px-5 py-4 text-center text-xs leading-5 text-muted">
        <strong className="text-ultraviolet">Loja em demonstração.</strong> Os preços são uma prévia. Nenhuma compra, cobrança ou entrega de Cash será realizada.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cashPackages.map((pack) => <CashPackageCard key={pack.amount} pack={pack} />)}
      </div>
    </section>
  );
}
