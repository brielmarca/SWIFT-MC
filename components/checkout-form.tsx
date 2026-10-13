"use client";

import { Clock3, ExternalLink, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

import type { Rank } from "@/data/ranks";
import {
  type CheckoutFieldErrors,
  type CheckoutFields,
  type CreatedOrder,
  startPayment,
  submitOrder,
  validateCheckoutFields,
} from "@/lib/orders/checkout-client";

type CheckoutFormProps = {
  rank: Rank;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

function formatExpiration(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function CheckoutForm({ rank }: CheckoutFormProps) {
  const [fields, setFields] = useState<CheckoutFields>({ minecraftUsername: "", email: "" });
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [apiError, setApiError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder>();
  const [isStartingPayment, setIsStartingPayment] = useState(false);
  const activeSubmission = useRef(false);
  const retryRequest = useRef<{ signature: string; key: string } | undefined>(undefined);

  function updateField(field: keyof CheckoutFields, value: string) {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError(undefined);
  }

  async function handlePayment() {
    if (!createdOrder || activeSubmission.current) return;

    activeSubmission.current = true;
    setIsStartingPayment(true);
    setApiError(undefined);

    try {
      const checkoutUrl = await startPayment(createdOrder);
      window.location.assign(checkoutUrl);
    } catch (error) {
      const code = error instanceof Error ? error.message : "PAYMENT_UNAVAILABLE";
      setApiError(
        code === "ORDER_NOT_PAYABLE"
          ? "Este pedido não está mais disponível para pagamento."
          : "Não foi possível abrir o Mercado Pago agora. Tente novamente.",
      );
      activeSubmission.current = false;
      setIsStartingPayment(false);
    }
  }

  function validateField(field: keyof CheckoutFields) {
    const fieldErrors = validateCheckoutFields(fields);
    setErrors((current) => ({ ...current, [field]: fieldErrors[field] }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeSubmission.current) return;

    const fieldErrors = validateCheckoutFields(fields);
    setErrors(fieldErrors);
    setApiError(undefined);

    if (Object.keys(fieldErrors).length > 0) return;

    const signature = JSON.stringify({ rankSlug: rank.slug, ...fields });
    const idempotencyKey =
      retryRequest.current?.signature === signature
        ? retryRequest.current.key
        : crypto.randomUUID();

    retryRequest.current = { signature, key: idempotencyKey };
    activeSubmission.current = true;
    setIsSubmitting(true);

    try {
      const order = await submitOrder(rank.slug, fields, idempotencyKey);
      setCreatedOrder(order);
    } catch (error) {
      const code = error instanceof Error ? error.message : "ORDER_UNAVAILABLE";
      setApiError(
        code === "INVALID_ORDER"
          ? "Revise o usuário e o e-mail informados."
          : code === "IDEMPOTENCY_CONFLICT"
            ? "Os dados mudaram durante o envio. Tente novamente."
            : "Não foi possível criar o pedido agora. Seus dados foram mantidos; tente novamente.",
      );
    } finally {
      activeSubmission.current = false;
      setIsSubmitting(false);
    }
  }

  if (createdOrder) {
    return (
      <section className="glass-panel mx-auto max-w-3xl overflow-hidden" aria-labelledby="order-created-title">
        <div className="border-b border-white/[0.07] bg-gradient-to-b from-violet/[0.12] to-transparent px-5 py-9 text-center sm:px-10 sm:py-12">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-violet/30 bg-violet/10 text-ultraviolet">
            <Clock3 size={30} aria-hidden="true" />
          </span>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-ultraviolet">Pedido criado</p>
          <h2 id="order-created-title" className="mt-3 text-3xl font-extrabold uppercase tracking-[-0.03em] text-ink">Aguardando pagamento</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted">Nenhum pagamento foi confirmado. A confirmação futura dependerá exclusivamente da validação segura do provedor.</p>
        </div>
        <div className="p-5 sm:p-8">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="micro-label">Número do pedido</dt><dd className="mt-2 font-bold tabular-nums text-ink">{createdOrder.orderNumber}</dd></div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="micro-label">Status</dt><dd className="mt-2 font-bold text-amber-300">Aguardando pagamento</dd></div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="micro-label">Rank selecionado</dt><dd className="mt-2 font-bold text-ink">Rank {createdOrder.rank.name}</dd></div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"><dt className="micro-label">Total</dt><dd className="mt-2 font-bold tabular-nums text-ink">{formatMoney(createdOrder.totalCents, createdOrder.currency)}</dd></div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 sm:col-span-2"><dt className="micro-label">Expira em</dt><dd className="mt-2 font-bold text-ink">{formatExpiration(createdOrder.expiresAt)}</dd></div>
          </dl>
          <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-muted">O Mercado Pago oferece PIX e cartão no ambiente seguro dele. O retorno ao site não confirma o pagamento; o pedido continuará pendente até validação pelo servidor.</p>
          {apiError && <p role="alert" className="mt-4 rounded-lg border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm leading-6 text-red-200">{apiError}</p>}
          <button type="button" className="button-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isStartingPayment} onClick={handlePayment}>
            {isStartingPayment ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Abrindo Mercado Pago...</> : <><ExternalLink size={18} aria-hidden="true" /> Pagar com Mercado Pago</>}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-12">
      <form id="checkout-order-form" className="space-y-6 lg:col-span-7" noValidate onSubmit={handleSubmit}>
        <section className="glass-panel p-5 sm:p-7" aria-labelledby="account-title">
          <div className="flex items-start gap-4">
            <span className="icon-well shrink-0"><ShieldCheck size={21} aria-hidden="true" /></span>
            <div><p className="micro-label !text-ultraviolet">Etapa 1</p><h2 id="account-title" className="mt-1 text-xl font-extrabold uppercase tracking-tight text-ink">Dados de ativação</h2><p className="mt-2 text-sm leading-6 text-muted">Use o nick exato da conta que receberá o rank.</p></div>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="minecraft-username" className="text-sm font-bold text-ink">Usuário do Minecraft <span className="text-ultraviolet" aria-hidden="true">*</span></label>
              <input id="minecraft-username" name="minecraftUsername" type="text" autoComplete="username" required value={fields.minecraftUsername} aria-invalid={Boolean(errors.minecraftUsername)} aria-describedby={errors.minecraftUsername ? "username-error" : "username-help"} onChange={(event) => updateField("minecraftUsername", event.currentTarget.value)} onBlur={() => validateField("minecraftUsername")} className="checkout-input mt-2" placeholder="SeuNick" />
              {errors.minecraftUsername ? <p id="username-error" role="alert" className="mt-2 text-xs leading-5 text-red-300">{errors.minecraftUsername}</p> : <p id="username-help" className="mt-2 text-xs leading-5 text-muted">Java ou Bedrock; espaços internos são preservados.</p>}
            </div>
            <div>
              <label htmlFor="checkout-email" className="text-sm font-bold text-ink">E-mail <span className="text-ultraviolet" aria-hidden="true">*</span></label>
              <input id="checkout-email" name="email" type="email" inputMode="email" autoComplete="email" required value={fields.email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : "email-help"} onChange={(event) => updateField("email", event.currentTarget.value)} onBlur={() => validateField("email")} className="checkout-input mt-2" placeholder="voce@exemplo.com" />
              {errors.email ? <p id="email-error" role="alert" className="mt-2 text-xs leading-5 text-red-300">{errors.email}</p> : <p id="email-help" className="mt-2 text-xs leading-5 text-muted">Usado apenas para identificação e suporte ao pedido.</p>}
            </div>
          </div>
        </section>

        <section className="glass-panel p-5 sm:p-7" aria-labelledby="payment-title">
          <p className="micro-label !text-ultraviolet">Etapa 2</p>
          <h2 id="payment-title" className="mt-1 text-xl font-extrabold uppercase tracking-tight text-ink">Pagamento seguro</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Depois de criar o pedido, você escolherá PIX ou cartão diretamente no Checkout Pro do Mercado Pago.</p>
        </section>

        <section className="glass-panel p-5 sm:p-7" aria-labelledby="coupon-title">
          <p className="micro-label !text-ultraviolet">Opcional</p><h2 id="coupon-title" className="mt-1 text-xl font-extrabold uppercase tracking-tight text-ink">Cupom</h2>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><div className="flex-1"><label htmlFor="coupon" className="sr-only">Código do cupom</label><input id="coupon" name="coupon" type="text" className="checkout-input uppercase" placeholder="CODIGO DO CUPOM" disabled /></div><button type="button" className="button-secondary !min-h-12 !px-5" disabled>Aplicar em breve</button></div>
        </section>
      </form>

      <aside className="glass-panel p-5 sm:p-7 lg:sticky lg:top-24 lg:col-span-5" aria-labelledby="order-title">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] pb-5"><div><p className="micro-label !text-ultraviolet">Seu pedido</p><h2 id="order-title" className="mt-1 text-xl font-extrabold uppercase tracking-tight text-ink">Resumo</h2></div><span className="rank-badge rank-badge-featured">{rank.name}</span></div>
        <div className="my-6 rounded-xl border border-violet/20 bg-gradient-to-br from-violet/15 to-transparent p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-extrabold uppercase text-ink">Rank {rank.name}</p><p className="mt-1 text-xs leading-5 text-muted">Pagamento via Mercado Pago</p></div><p className="font-extrabold tabular-nums text-ink">{rank.price}</p></div><div className="mt-4 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs"><span className="text-muted">Duração</span><strong className="text-ink">{rank.duration}</strong></div></div>
        <dl className="space-y-3 text-sm"><div className="flex items-center justify-between gap-4"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums text-ink">{rank.price}</dd></div><div className="flex items-center justify-between gap-4"><dt className="text-muted">Desconto</dt><dd className="tabular-nums text-muted">R$ 0,00</dd></div><div className="flex items-end justify-between gap-4 border-t border-white/[0.08] pt-5"><dt className="font-bold uppercase tracking-wide text-ink">Total</dt><dd className="text-2xl font-extrabold tabular-nums text-ink">{rank.price}</dd></div></dl>
        {apiError && <p role="alert" className="mt-5 rounded-lg border border-red-400/25 bg-red-400/[0.07] px-4 py-3 text-sm leading-6 text-red-200">{apiError}</p>}
        <button type="submit" form="checkout-order-form" className="button-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isSubmitting} aria-disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Criando pedido...</> : <><LockKeyhole size={18} aria-hidden="true" /> Criar pedido</>}
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-muted">O pedido é criado primeiro; o pagamento começa somente na ação seguinte.</p>
        <div className="mt-6 space-y-3 border-t border-white/[0.07] pt-5"><div className="flex gap-3 text-xs leading-5 text-muted"><ShieldCheck size={17} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" /><span>Preço, total, moeda e status são definidos exclusivamente pelo servidor.</span></div><div className="flex gap-3 text-xs leading-5 text-muted"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-ultraviolet" aria-hidden="true" /><span>Nenhuma credencial bancária é solicitada ou processada.</span></div></div>
      </aside>
    </div>
  );
}
