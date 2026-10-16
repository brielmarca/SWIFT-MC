"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { formatMonthlyPrice } from "@/data/ranks";
import { useCheckoutDraft } from "./checkout-draft-provider";
import { DiscordLink } from "./discord-link";

export function DemoCheckoutSuccess() {
  const { receipt } = useCheckoutDraft();
  return <section className="glass-panel mx-auto max-w-3xl p-6 sm:p-10" aria-labelledby="demo-title">
    <p className="eyebrow">Checkout demo</p>
    <CheckCircle2 size={40} className="mt-6 text-ultraviolet" aria-hidden="true" />
    <h1 id="demo-title" className="page-title mt-5">{receipt ? "Demonstração concluída!" : "Nenhuma demonstração nesta sessão"}</h1>
    <p className="mt-4 leading-7 text-muted">Nenhum pedido real foi criado, nenhum pagamento foi realizado e nenhum benefício foi ativado.</p>
    {receipt ? <div className="mt-6 rounded-xl border border-violet/20 bg-violet/5 p-5">
      <h2 className="font-bold text-ink">Resumo da simulação</h2>
      <ul className="mt-4 space-y-3">{receipt.items.map((rank) => <li key={rank.slug} className="flex justify-between gap-4 text-sm text-muted"><span>{rank.name} · Mensal</span><span>{rank.price ?? "Preço em breve"}</span></li>)}</ul>
      <p className="mt-5 border-t border-white/10 pt-4 font-bold text-ink">Total da prévia: {formatMonthlyPrice(receipt.totalCents) ?? "Preço em breve"}</p>
    </div> : <p className="mt-4 text-sm text-muted">Adicione um rank e conclua o checkout demo. O resumo é apagado ao recarregar a página.</p>}
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/store" className="button-primary">Voltar à loja</Link><DiscordLink className="button-secondary"><MessageCircle size={18} aria-hidden="true" /> Entrar no Discord</DiscordLink></div>
  </section>;
}
