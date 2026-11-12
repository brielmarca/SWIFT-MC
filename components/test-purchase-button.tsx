"use client";
import { useRef, useState } from "react";
import { redirectToStripeCheckout } from "@/lib/stripe-checkout-client";

export function TestPurchaseButton({ slug, type, disabled = false, stagingBypass = false }: { slug: string; type: "vip" | "cash"; disabled?: boolean; stagingBypass?: boolean }) {
  const intent = useRef<{ slug: string; key: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function buy() {
    if (pending) return;
    if (intent.current?.slug !== slug) intent.current = { slug, key: crypto.randomUUID() };
    setPending(true);
    setError("");
    try { await redirectToStripeCheckout({ type, rankSlug: slug, idempotencyKey: intent.current.key }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Pagamento indisponível."); setPending(false); }
  }
  return <div><button className="button-primary" disabled={disabled || pending} onClick={buy}>{pending ? "Abrindo Stripe…" : "Pagar com Stripe"}</button>{disabled && <p className="mt-3 text-sm text-muted">{stagingBypass ? "Verifique seu email para comprar." : "Verifique seu email e vincule sua conta Minecraft para comprar."}</p>}{error && <p role="alert" className="mt-3 text-sm text-amber-100">{error}</p>}</div>;
}
