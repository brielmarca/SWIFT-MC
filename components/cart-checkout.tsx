"use client";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "./cart-provider";
import { TestPurchaseButton } from "./test-purchase-button";

export function CartCheckout({ email, verified, testPurchases = false }: { email: string; verified: boolean; testPurchases?: boolean }) {
  const { items, ready } = useCart();
  const [selection, setSelection] = useState("");
  const rank = items.find(item => item.slug === selection) ?? items[0];
  if (!ready) return <p role="status">Carregando carrinho…</p>;
  if (!rank) return <section className="glass-panel p-8"><h2 className="text-2xl font-bold">Seu carrinho está vazio</h2><Link className="button-primary mt-6" href="/store">Explorar ranks</Link></section>;
  return <section className="glass-panel max-w-3xl space-y-6 p-6 sm:p-8" aria-label="Revisão da compra">
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Escolha o VIP desta compra</h2>
      <p className="text-sm text-muted">Um VIP por pagamento. Os outros itens continuam no carrinho. Compra avulsa pelo período indicado, sem renovação automática.</p>
      {items.map(item => <label key={item.slug} className="flex min-h-11 items-center gap-3"><input type="radio" name="rank" value={item.slug} checked={rank.slug === item.slug} onChange={() => setSelection(item.slug)} />{item.name} · {item.duration} · {item.price}</label>)}
      <p className="text-sm text-muted">Conta: {email}. O nome do jogador será confirmado com a conta Minecraft vinculada antes de qualquer compra.</p>
      <p className="font-bold">Total desta seleção: {rank.price} · BRL</p>
    </div>
    {testPurchases ? (verified ? <TestPurchaseButton slug={rank.slug} type="vip" /> : <Link href="/account/profile#linked" className="button-primary">Concluir verificação da conta</Link>) : <div role="status" className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
      <strong>Compras temporariamente indisponíveis.</strong> Tente novamente mais tarde.
      {" Quando as compras forem liberadas, será necessário ter e-mail verificado e Minecraft vinculado."}
    </div>}
    <div className="flex flex-wrap gap-3">
      <Link href="/store" className="button-primary">Voltar à loja</Link>
      <Link href="/account/orders" className="button-secondary">Consultar meus pedidos</Link>
    </div>
  </section>;
}
