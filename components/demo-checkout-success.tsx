"use client";

import Link from "next/link";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { formatMonthlyPrice } from "@/data/ranks";
import { useCheckoutDraft } from "./checkout-draft-provider";
import { DiscordLink } from "./discord-link";

export function DemoCheckoutSuccess() {
  const { receipt } = useCheckoutDraft();
  return <section className="glass-panel mx-auto max-w-3xl p-6 sm:p-10" aria-labelledby="demo-title">
    <p className="eyebrow">Checkout demo{receipt ? " · Etapa 3 de 3" : ""}</p>
    <CheckCircle2 size={40} className="mt-6 text-ultraviolet" aria-hidden="true" />
    <h1 id="demo-title" className="page-title mt-5">{receipt ? "Simulação concluída!" : "Nenhuma demonstração nesta sessão"}</h1>
    <p className="mt-4 leading-7 text-muted">Nenhum pedido real foi criado. Nenhuma cobrança foi feita e nenhum VIP, kit ou benefício foi ativado.</p>
    {receipt ? <div className="mt-6 rounded-xl border border-violet/20 bg-violet/5 p-5">
      <h2 className="font-bold text-ink">Resumo da simulação</h2>
      <ul className="mt-4 space-y-3">{receipt.items.map((rank) => <li key={rank.slug} className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted"><span>{rank.name} · {rank.duration}</span><span className="font-bold tabular-nums text-ink">{rank.price ?? "Preço em breve"}</span></li>)}</ul>
      <p className="mt-5 flex flex-wrap justify-between gap-2 border-t border-white/10 pt-4 font-bold text-ink"><span>Total mensal da simulação:</span><span className="whitespace-nowrap tabular-nums">{formatMonthlyPrice(receipt.totalCents) ?? "Total indisponível"}</span></p>
    </div> : <p className="mt-4 text-sm text-muted">Adicione um rank e conclua o checkout demo. O resumo é apagado ao recarregar a página.</p>}
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/store" className="button-primary">Voltar à loja</Link><DiscordLink className="button-secondary"><MessageCircle size={18} aria-hidden="true" /> Entrar no Discord</DiscordLink></div>
  </section>;
}
