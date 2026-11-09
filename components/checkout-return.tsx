"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const STATUS_MESSAGES: Record<string, { title: string; text: string }> = {
  PENDING_PAYMENT: { title: "Pagamento em processamento", text: "A confirmação chega do Stripe em instantes. Esta página atualiza sozinha." },
  PAID: { title: "Pagamento confirmado", text: "Recebemos seu pagamento. O VIP entra na fila de entrega para o personagem informado." },
  FULFILLED: { title: "VIP entregue", text: "O benefício já foi aplicado ao personagem informado. Bom jogo!" },
  PAYMENT_FAILED: { title: "Pagamento não aprovado", text: "O Stripe não confirmou o pagamento. Nenhum valor foi cobrado e nenhum VIP foi ativado." },
  EXPIRED: { title: "Sessão de pagamento expirada", text: "O prazo terminou antes da confirmação. Você pode iniciar uma nova compra." },
  REFUNDED: { title: "Pagamento reembolsado", text: "O valor foi devolvido. O VIP correspondente não fica ativo." },
  REVIEW_REQUIRED: { title: "Pagamento em análise", text: "Identificamos uma divergência e nossa equipe vai revisar antes de liberar o pedido." },
};

type Props = { result: "success" | "cancel"; orderNumber: string | null };

export function CheckoutReturn({ result, orderNumber }: Props) {
  const [status, setStatus] = useState<string | null>(result === "cancel" ? "CANCELLED" : null);
  const [failed, setFailed] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (result !== "success" || !orderNumber) return;
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    async function poll() {
      attempts.current += 1;
      try {
        const response = await fetch(`/api/user/orders/${encodeURIComponent(orderNumber!)}`, { cache: "no-store" });
        if (cancelled) return;
        if (response.ok) {
          const body = await response.json();
          const next: string = body.order?.status ?? "PENDING_PAYMENT";
          setStatus(next);
          if (next === "PAID" || next === "FULFILLED" || next === "REFUNDED" || next === "REVIEW_REQUIRED" || next === "PAYMENT_FAILED" || next === "EXPIRED") return;
        } else if (response.status === 404) {
          setFailed(true);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      if (attempts.current >= 10) { setFailed(true); return; }
      timer = setTimeout(poll, 3000);
    }
    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [orderNumber, result]);

  if (result === "cancel") {
    return (
      <section className="glass-panel mx-auto max-w-3xl p-8 text-center sm:p-12">
        <p className="eyebrow">Pagamento cancelado</p>
        <h1 className="mt-4 text-3xl font-extrabold uppercase text-ink">Compra não concluída</h1>
        <p className="mt-4 text-sm leading-6 text-muted">Você voltou do Stripe sem concluir o pagamento. Nenhum valor foi cobrado e nenhum VIP foi ativado. Seu carrinho continua neste dispositivo.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/store" className="button-primary">Voltar à loja</Link><Link href="/checkout" className="button-secondary">Tentar novamente</Link></div>
      </section>
    );
  }

  const message = status ? STATUS_MESSAGES[status] : null;
  return (
    <section className="glass-panel mx-auto max-w-3xl p-8 text-center sm:p-12">
      <p className="eyebrow">Pedido {orderNumber ?? "—"}</p>
      <h1 className="mt-4 text-3xl font-extrabold uppercase text-ink">{message?.title ?? "Confirmando pagamento"}</h1>
      <p className="mt-4 text-sm leading-6 text-muted">{message?.text ?? "Aguarde enquanto consultamos o status do seu pedido com segurança."}</p>
      {!message && <p role="status" className="mt-6 text-sm text-ultraviolet">Verificando status…</p>}
      {failed && <p role="alert" className="mt-6 text-sm text-amber-200">A confirmação está demorando mais que o esperado. Consulte seus pedidos para ver o status atualizado.</p>}
      <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/account/orders" className="button-primary">Ver meus pedidos</Link><Link href="/store" className="button-secondary">Voltar à loja</Link></div>
      <p className="mt-6 text-xs leading-5 text-muted">O status acima vem do nosso servidor. A confirmação nunca é feita apenas pelo redirecionamento do navegador.</p>
    </section>
  );
}
