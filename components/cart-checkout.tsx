"use client";

import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatPrice } from "@/data/ranks";
import { validateCheckoutPreview } from "@/lib/checkout-preview";
import { useCart } from "./cart-provider";
import { useCheckoutDraft } from "./checkout-draft-provider";
import { MinecraftProfileLookup } from "./minecraft-profile-lookup";

export function CartCheckout() {
  const { items, subtotalCents, removeItem, openCart, ready } = useCart();
  const { draft, updateDraft } = useCheckoutDraft();
  const [stage, setStage] = useState<"details" | "review">("details");
  const [errors, setErrors] = useState({ username: "", email: "" });
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  useEffect(() => {
    if (previousStage.current !== stage) heading.current?.focus();
    previousStage.current = stage;
  }, [stage]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateCheckoutPreview(draft.username, draft.email);
    setErrors(nextErrors);
    if (nextErrors.username || nextErrors.email) {
      document.getElementById(nextErrors.username ? "preview-username" : "preview-email")?.focus();
      return;
    }
    setStage("review");
  }

  if (!ready) return <p className="glass-panel min-h-48 p-8 text-muted" role="status">Carregando carrinho…</p>;
  if (!items.length) return <section className="glass-panel p-8 text-center">
    <h2 className="text-2xl font-bold text-ink">Seu carrinho está vazio</h2>
    <p className="mt-3 text-muted">Adicione um rank para revisar sua seleção. Seus dados preenchidos permanecem nesta sessão.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/store" className="button-primary">Explorar ranks</Link><button type="button" disabled className="button-secondary cursor-not-allowed opacity-50">Finalizar compra</button></div>
  </section>;

  return <div>
    <button type="button" onClick={openCart} className="button-secondary mb-6"><ArrowLeft size={17} aria-hidden="true" /> Voltar ao carrinho</button>
    <ol aria-label="Etapas do checkout" className="mb-6 flex flex-wrap gap-4 text-sm font-bold"><li aria-current={stage === "details" ? "step" : undefined} className="text-muted aria-[current=step]:text-ultraviolet">1. Dados do jogador</li><li aria-current={stage === "review" ? "step" : undefined} className="text-muted aria-[current=step]:text-ultraviolet">2. Revisão</li></ol>
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <section className="glass-panel min-w-0 p-5 sm:p-8 lg:col-span-7">
        <h2 ref={heading} tabIndex={-1} className="text-2xl font-bold text-ink focus:outline-none">{stage === "details" ? "Dados do jogador" : "Revise seus dados"}</h2>
        {stage === "details" ? <form onSubmit={review} noValidate className="mt-6 space-y-6">
          <div>
            <label htmlFor="preview-username" className="text-sm font-bold text-ink">Nome no Minecraft Java</label>
            <input id="preview-username" name="minecraftUsername" required maxLength={16} autoComplete="off" autoCapitalize="none" spellCheck={false} className="checkout-input mt-2" value={draft.username} onChange={(event) => { updateDraft("username", event.target.value); setErrors((previous) => ({ ...previous, username: "" })); }} aria-invalid={Boolean(errors.username)} aria-describedby="username-help username-error" />
            <p id="username-help" className="mt-2 text-xs leading-5 text-muted">De 3 a 16 letras, números ou sublinhado. A consulta envia somente o nome ao serviço de perfis.</p>
            <p id="username-error" className="mt-1 text-sm text-red-300" role="alert">{errors.username}</p>
            <MinecraftProfileLookup key={draft.username} username={draft.username} />
          </div>
          <div>
            <label htmlFor="preview-email" className="text-sm font-bold text-ink">E-mail</label>
            <input id="preview-email" name="email" type="email" required maxLength={254} autoComplete="email" className="checkout-input mt-2" value={draft.email} onChange={(event) => { updateDraft("email", event.target.value); setErrors((previous) => ({ ...previous, email: "" })); }} aria-invalid={Boolean(errors.email)} aria-describedby="email-help email-error" />
            <p id="email-help" className="mt-2 text-xs leading-5 text-muted">Seus dados ficam apenas na memória desta sessão e não são enviados para criar pedidos. Recarregar a página apaga os campos.</p>
            <p id="email-error" className="mt-1 text-sm text-red-300" role="alert">{errors.email}</p>
          </div>
          <button type="submit" className="button-primary w-full sm:w-auto">Revisar seleção</button>
        </form> : <div className="mt-6">
          <dl className="space-y-5"><div><dt className="micro-label">Minecraft Java</dt><dd className="mt-2 break-all font-bold text-ink">{draft.username}</dd></div><div><dt className="micro-label">E-mail</dt><dd className="mt-2 break-all text-ink">{draft.email}</dd></div></dl>
          <button type="button" onClick={() => setStage("details")} className="button-secondary mt-6">Editar dados</button>
          <p className="mt-5 text-sm leading-6 text-muted">Esta é uma revisão local. Nenhum pedido foi criado e nenhum benefício foi ativado.</p>
        </div>}
      </section>
      <aside className="glass-panel min-w-0 p-5 sm:p-8 lg:col-span-5" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title" className="text-xl font-bold uppercase text-ink">Resumo da seleção</h2>
        <ul className="mt-5 divide-y divide-white/10">{items.map((rank) => <li key={rank.slug} className="flex items-center justify-between gap-3 py-4">
          <div className="min-w-0"><Link className="rounded font-bold text-ink hover:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet" href={`/ranks/${rank.slug}`}>{rank.name}</Link><p className="mt-1 text-xs text-muted">{rank.duration}</p><p className="mt-2 font-bold tabular-nums text-ultraviolet">{rank.price}</p></div>
          <button type="button" className="icon-button" onClick={() => removeItem(rank.slug)} aria-label={`Remover ${rank.name} do checkout`}><Trash2 size={18} aria-hidden="true" /></button>
        </li>)}</ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5"><span className="micro-label">Subtotal</span><strong className="text-2xl tabular-nums text-ink">{formatPrice(subtotalCents)}</strong></div>
        <button type="button" disabled aria-describedby="checkout-unavailable" className="button-primary mt-6 w-full cursor-not-allowed opacity-50">Concluir compra — em breve</button>
        <p id="checkout-unavailable" className="mt-3 text-sm leading-6 text-muted">A conclusão de compras ainda não está disponível. Você pode revisar os itens e seus dados sem realizar uma cobrança.</p>
      </aside>
    </div>
  </div>;
}
