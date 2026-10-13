import assert from "node:assert/strict";
import test from "node:test";

import { startPayment, submitOrder, validateCheckoutFields } from "@/lib/orders/checkout-client";

test("validates invalid username and email before checkout submission", () => {
  const errors = validateCheckoutFields({
    minecraftUsername: "player;/op",
    email: "not-an-email",
  });

  assert.ok(errors.minecraftUsername);
  assert.ok(errors.email);
});

test("checkout request sends only rank, username, and email", async () => {
  let requestBody: Record<string, unknown> | undefined;
  let requestHeaders: Headers | undefined;

  const order = await submitOrder(
    "eclipse",
    { minecraftUsername: "Player Name", email: "player@example.com" },
    "12345678-1234-1234-1234-123456789abc",
    async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requestHeaders = new Headers(init?.headers);
      return Response.json({
        orderNumber: "SWIFT-20261003-ABC123",
        paymentToken: "a".repeat(43),
        status: "PENDING_PAYMENT",
        rank: { slug: "eclipse", name: "Eclipse", duration: "Vitalício" },
        totalCents: 3990,
        currency: "BRL",
        expiresAt: "2026-10-03T13:04:56.789Z",
      });
    },
  );

  assert.deepEqual(requestBody, {
    rankSlug: "eclipse",
    minecraftUsername: "Player Name",
    email: "player@example.com",
  });
  assert.equal(requestHeaders?.get("Idempotency-Key"), "12345678-1234-1234-1234-123456789abc");
  assert.equal(order.status, "PENDING_PAYMENT");
});

test("payment start sends only the server-issued bearer token", async () => {
  let requestUrl: string | URL | Request | undefined;
  let requestInit: RequestInit | undefined;

  const checkoutUrl = await startPayment(
    { orderNumber: "SWIFT-20261003-ABC123DEF0", paymentToken: "token_value_123456789012345678901234567890" },
    async (input, init) => {
      requestUrl = input;
      requestInit = init;
      return Response.json({ checkoutUrl: "https://www.mercadopago.com.br/checkout/v1/redirect" });
    },
  );

  assert.equal(requestUrl, "/api/orders/SWIFT-20261003-ABC123DEF0/payment");
  assert.equal(requestInit?.method, "POST");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer token_value_123456789012345678901234567890");
  assert.equal(requestInit?.body, undefined);
  assert.equal(checkoutUrl, "https://www.mercadopago.com.br/checkout/v1/redirect");
});

test("server failure does not mutate entered checkout values", async () => {
  const fields = { minecraftUsername: "Preserved Player", email: "keep@example.com" };
  const originalFields = { ...fields };

  await assert.rejects(
    submitOrder("overdrive", fields, "12345678-1234-1234-1234-123456789abc", async () =>
      Response.json({ error: "Unavailable" }, { status: 503 }),
    ),
    /ORDER_UNAVAILABLE/,
  );

  assert.deepEqual(fields, originalFields);
});