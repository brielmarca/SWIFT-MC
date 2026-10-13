import assert from "node:assert/strict";
import test from "node:test";

import {
  createMercadoPagoOrdersClient,
  formatCentsAsDecimal,
  isValidMercadoPagoCheckoutUrl,
  MercadoPagoUnavailableError,
} from "@/lib/payments/mercado-pago";
import {
  parseMercadoPagoWebhookEnvelope,
  verifyMercadoPagoSignature,
} from "@/lib/payments/mercado-pago-webhook";
import { createHmac } from "node:crypto";

test("formats BRL cents as an exact two-place decimal string", () => {
  assert.equal(formatCentsAsDecimal(1), "0.01");
  assert.equal(formatCentsAsDecimal(1990), "19.90");
  assert.equal(formatCentsAsDecimal(6990), "69.90");
  assert.equal(formatCentsAsDecimal(123456789), "1234567.89");
  assert.throws(() => formatCentsAsDecimal(1.5));
});

test("accepts only credential-free HTTPS Mercado Pago checkout URLs", () => {
  assert.equal(isValidMercadoPagoCheckoutUrl("https://www.mercadopago.com.br/checkout/v1/redirect"), true);
  assert.equal(isValidMercadoPagoCheckoutUrl("http://www.mercadopago.com.br/checkout"), false);
  assert.equal(isValidMercadoPagoCheckoutUrl("https://mercadopago.com.br.evil.example/checkout"), false);
  assert.equal(isValidMercadoPagoCheckoutUrl("https://user:pass@mercadopago.com.br/checkout"), false);
  assert.equal(isValidMercadoPagoCheckoutUrl("javascript:alert(1)"), false);
});

test("Mercado Pago client sends credentials only in the server request header", async () => {
  let capturedHeaders: Headers | undefined;
  const client = createMercadoPagoOrdersClient("secret-access-token", async (_input, init) => {
    capturedHeaders = new Headers(init?.headers);
    return Response.json({
      id: "ORD01",
      checkout_url: "https://www.mercadopago.com.br/checkout/v1/redirect?order_id=ORD01",
      status: "created",
      status_detail: "created",
    });
  });

  const result = await client.createOrder(
    {
      type: "online",
      processing_mode: "manual",
      total_amount: "19.90",
      external_reference: "SWIFT-20261003-ABC123DEF0",
      payer: { email: "buyer@example.com" },
      items: [{ title: "Rank VIP", quantity: 1, unit_price: "19.90", unit_measure: "unit", total_amount: "19.90", external_code: "vip" }],
      config: { online: { success_url: "https://swift.example/checkout/return/success", pending_url: "https://swift.example/checkout/return/pending", failure_url: "https://swift.example/checkout/return/failure", auto_return: "all" } },
    },
    "12345678-1234-4123-a123-123456789012",
  );

  assert.equal(capturedHeaders?.get("Authorization"), "Bearer secret-access-token");
  assert.equal(capturedHeaders?.get("X-Idempotency-Key"), "12345678-1234-4123-a123-123456789012");
  assert.equal(result.providerOrderId, "ORD01");
  assert.equal("accessToken" in result, false);
});

test("rejects an invalid provider checkout URL without exposing the response", async () => {
  const client = createMercadoPagoOrdersClient("secret-access-token", async () =>
    Response.json({ id: "ORD01", checkout_url: "https://attacker.example/steal", private_data: "provider-secret" }),
  );

  await assert.rejects(
    client.createOrder(
      {
        type: "online",
        processing_mode: "manual",
        total_amount: "19.90",
        payer: { email: "buyer@example.com" },
        items: [{ title: "Rank VIP", quantity: 1, unit_price: "19.90", unit_measure: "unit", total_amount: "19.90", external_code: "vip" }],
        config: { online: { success_url: "https://swift.example/checkout/return/success", pending_url: "https://swift.example/checkout/return/pending", failure_url: "https://swift.example/checkout/return/failure", auto_return: "all" } },
      },
      "12345678-1234-4123-a123-123456789012",
    ),
    (error: unknown) => error instanceof MercadoPagoUnavailableError && !error.message.includes("provider-secret"),
  );
});

test("validates the current Mercado Pago order webhook manifest", () => {
  const secret = "webhook-secret";
  const providerOrderId = "ORD01ABC";
  const requestId = "request-123";
  const timestamp = "1742505638683";
  const digest = createHmac("sha256", secret)
    .update(`id:${providerOrderId.toLowerCase()};request-id:${requestId};ts:${timestamp};`)
    .digest("hex");

  assert.equal(verifyMercadoPagoSignature({
    providerOrderId,
    requestId,
    signature: `ts=${timestamp},v1=${digest}`,
  }, secret), true);
  assert.equal(verifyMercadoPagoSignature({
    providerOrderId,
    requestId,
    signature: `ts=${timestamp},v1=${"0".repeat(64)}`,
  }, secret), false);
});

test("rejects malformed signatures and unsupported webhook envelopes", () => {
  assert.equal(verifyMercadoPagoSignature({
    providerOrderId: "ORD01ABC",
    requestId: "request-123",
    signature: "ts=not-a-time,v1=not-hex",
  }, "webhook-secret"), false);
  assert.equal(parseMercadoPagoWebhookEnvelope({ type: "payment", action: "payment.updated", data: { id: "1" } }), null);
  assert.equal(parseMercadoPagoWebhookEnvelope({ type: "order", action: "order.processed", data: { id: "bad/id" } }), null);
});

test("Mercado Pago reconciliation re-fetches a bounded provider order", async () => {
  let requestUrl = "";
  let authorization = "";
  const client = createMercadoPagoOrdersClient("secret-access-token", async (input, init) => {
    requestUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Response.json({
      id: "ORD01ABC",
      external_reference: "SWIFT-20261003-ABC123DEF0",
      total_amount: "19.90",
      currency_id: "BRL",
      status: "processed",
      status_detail: "accredited",
      transactions: { payments: [{ id: "PAY01ABC", payment_method: { id: "pix", type: "bank_transfer" } }] },
    });
  });

  const order = await client.getOrder("ORD01ABC");
  assert.equal(requestUrl, "https://api.mercadopago.com/v1/orders/ORD01ABC");
  assert.equal(authorization, "Bearer secret-access-token");
  assert.deepEqual(order, {
    id: "ORD01ABC",
    externalReference: "SWIFT-20261003-ABC123DEF0",
    totalAmount: "19.90",
    currency: "BRL",
    status: "processed",
    statusDetail: "accredited",
    paymentId: "PAY01ABC",
    paymentMethod: "pix",
  });
});
