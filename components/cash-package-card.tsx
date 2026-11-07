"use client";

import Image from "next/image";
import { ChevronDown, Gift, Info, ShoppingBag } from "lucide-react";
import { useRef, useState } from "react";
import type { CashPackage } from "@/data/cash-packages";
import { redirectToStripeCheckout } from "@/lib/stripe-checkout-client";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const quantity = new Intl.NumberFormat("pt-BR");

export function CashPackageCard({ pack }: { pack: CashPackage }) {
  const [showDetails, setShowDetails] = useState(false);
  const previewRef = useRef<HTMLDialogElement>(null);
  const name = `${quantity.format(pack.amount)} Cash`;
  const detailsId = `cash-details-${pack.amount}`;

  async function handleBuyWithStripe() {
    const username = window.prompt("Informe seu nome de usuário no Minecraft Java:");
    if (!username) return;
    const email = window.prompt("Informe seu e-mail:");
    if (!email) return;

    try {
      await redirectToStripeCheckout({
        type: "coins",
        coinsPackageId: pack.amount,
        minecraftUsername: username.trim(),
        email: email.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "StripeCheckoutError") {
        alert((error as { message: string }).message);
      } else {
        alert("Não foi possível iniciar a compra. Tente novamente.");
      }
    }
  }

  return (
    <article className="rank-card-tall group overflow-hidden motion-safe:hover:-translate-y-1" aria-labelledby={`cash-title-${pack.amount}`}>
      <div className="relative flex flex-col items-center justify-center overflow-hidden border-b border-white/5 bg-gradient-to-br from-deep/15 via-card to-void">
        <div className="stage-grid" aria-hidden="true" />
        <div className="relative flex w-full flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <span className="content-chip">50% OFF</span>
          {pack.survivalOnly && <span className="rank-badge">Exclusivo Survival</span>}
        </div>
        <Image
          src={`/brand/cash-${pack.artwork}.svg`}
          alt=""
          width={240}
          height={160}
          className="h-40 w-60 max-w-full object-contain transition-transform duration-200 motion-safe:group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-5 pb-6">
        <h3 id={`cash-title-${pack.amount}`} className="text-xl font-extrabold uppercase tracking-tight text-ink">{name}</h3>
        <p className="mt-2 flex min-h-6 items-center gap-2 text-sm font-semibold text-ultraviolet">
          <Gift size={16} aria-hidden="true" />
          {pack.bonus ? `+ ${quantity.format(pack.bonus)} Cash de bônus` : "Seu primeiro pacote de Cash"}
        </p>
        <div className="mt-5">
          <p className="text-xs text-muted"><span className="sr-only">Preço original: </span><s>{currency.format(pack.originalPrice / 100)}</s></p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-ultraviolet"><span className="sr-only">Preço promocional: </span>{currency.format(pack.price / 100)}</p>
          <p className="mt-2 text-xs leading-5 text-muted">{quantity.format(pack.amount + pack.bonus)} Cash no total · Prévia demo</p>
        </div>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            className="button-primary w-full px-4"
            aria-label={`Comprar · Demo — ${name}`}
            aria-haspopup="dialog"
            onClick={() => previewRef.current?.showModal()}
          >
            <ShoppingBag size={16} aria-hidden="true" /> Comprar · Demo
          </button>
          <button
            type="button"
            onClick={handleBuyWithStripe}
            className="button-secondary w-full px-4 border-white/20 hover:bg-white/10 text-white"
          >
            <span className="flex items-center justify-center gap-2">
              <span className="text-xs">Stripe</span>
              Comprar agora
            </span>
          </button>
          <button
            type="button"
            className="button-secondary w-full px-4"
            aria-expanded={showDetails}
            aria-controls={detailsId}
            aria-label={`Informações do pacote de ${name}`}
            onClick={() => setShowDetails((current) => !current)}
          >
            <Info size={16} aria-hidden="true" /> <span className="min-w-0">Informações do pacote</span>
            <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
          </button>
        </div>
        <div id={detailsId} hidden={!showDetails} className="mt-4 rounded-lg border border-violet/20 bg-deep/10 p-4 text-xs leading-6 text-muted">
          <p className="font-bold text-ink">O que inclui</p>
          <ul className="mt-1">
            <li>{name}{pack.bonus > 0 ? ` + ${quantity.format(pack.bonus)} Cash de bônus` : ""}.</li>
            <li>Total do pacote: {quantity.format(pack.amount + pack.bonus)} Cash.</li>
            {pack.survivalOnly && <li>Pacote exclusivo para o Survival.</li>}
            <li>50% de desconto sobre o preço original.</li>
          </ul>
          <p className="mt-2">Demonstração visual: nenhum pedido é criado e nenhum Cash é creditado.</p>
        </div>
        <dialog
          ref={previewRef}
          aria-labelledby={`cash-preview-title-${pack.amount}`}
          aria-describedby={`cash-preview-description-${pack.amount}`}
          className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-xl border border-violet/25 bg-card p-6 text-ink shadow-card backdrop:bg-void/80 backdrop:backdrop-blur-sm"
        >
          <p className="eyebrow">Somente demonstração</p>
          <h2 id={`cash-preview-title-${pack.amount}`} className="mt-3 text-xl font-extrabold uppercase">Prévia de {name}</h2>
          <p className="mt-3 font-bold text-ultraviolet">{quantity.format(pack.amount + pack.bonus)} Cash no total · {currency.format(pack.price / 100)}</p>
          <p id={`cash-preview-description-${pack.amount}`} className="mt-4 text-sm leading-6 text-muted">
            Esta compra é apenas uma demonstração. Nenhuma cobrança, pedido ou entrega de Cash será realizada.
          </p>
          <form method="dialog" className="mt-6">
            <button type="submit" className="button-primary w-full">Entendi, voltar aos pacotes</button>
          </form>
        </dialog>
      </div>
    </article>
  );
}
