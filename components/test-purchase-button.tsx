"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { redirectToStripeCheckout, StripeCheckoutError } from "@/lib/stripe-checkout-client";

export function TestPurchaseButton({ slug, type }: { slug: string; type: "vip" | "cash" }) {
  const intent = useRef<{ slug: string; key: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [requiredAction, setRequiredAction] = useState<"email" | "minecraft" | null>(null);
  async function buy() {
    if (pending) return;
    if (intent.current?.slug !== slug) intent.current = { slug, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    setRequiredAction(null);
    try {
      await redirectToStripeCheckout({ type, rankSlug: slug, idempotencyKey: intent.current.key });
    } catch (cause) {
      if (cause instanceof StripeCheckoutError && cause.code === "MINECRAFT_LINK_REQUIRED") setRequiredAction("minecraft");
      else if (cause instanceof StripeCheckoutError && cause.code === "EMAIL_NOT_VERIFIED") setRequiredAction("email");
      setError(cause instanceof Error ? cause.message : "Pagamento indisponível.");
      setPending(false);
    }
  }
  return <div>
    <button type="button" className="button-primary" disabled={pending} onClick={buy}>{pending ? "Abrindo Stripe…" : "Pagar com Stripe"}</button>
    {error && <p role="alert" className="mt-3 text-sm text-amber-100">{error}</p>}
    {requiredAction && <Link className="button-secondary mt-3" href={requiredAction === "minecraft" ? "/account/profile#linked" : "/account/profile#email-verification"}>{requiredAction === "minecraft" ? "Vincular minha conta Minecraft" : "Verificar meu e-mail"}</Link>}
  </div>;
}
