import { getStripeWebhookConfig } from "@/lib/server-env";
import { getPrisma } from "@/lib/prisma";
import { createStripeCheckoutClient } from "@/lib/payments/stripe-checkout";
import { startStripeCheckout } from "@/lib/payments/stripe-checkout";
import { createOrder } from "@/lib/orders/create-order";
import { validateOrderInput } from "@/lib/orders/order-input";
import { cashPackages } from "@/data/cash-packages";
import { OrderStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";

const ORDER_LIFETIME_MS = 30 * 60 * 1000;

type StripeCheckoutRequest = {
  type: "vip" | "coins";
  rankSlug?: string;
  coinsPackageId?: number;
  minecraftUsername: string;
  email: string;
  idempotencyKey: string;
};

export async function POST(request: Request): Promise<Response> {
  // Check if Stripe is configured; if not, preserve demo mode.
  let config: { secretKey: string; webhookSecret: string };
  try {
    config = getStripeWebhookConfig();
  } catch {
    return Response.json(
      { error: "DEMO_ONLY", message: "Checkout em demonstração está ativo." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let body: StripeCheckoutRequest;
  try {
    body = (await request.json()) as StripeCheckoutRequest;
  } catch {
    return Response.json(
      { error: "INVALID_REQUEST_BODY" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    (body.type !== "vip" && body.type !== "coins") ||
    typeof body.minecraftUsername !== "string" ||
    body.minecraftUsername.trim().length < 3 ||
    body.minecraftUsername.trim().length > 32 ||
    typeof body.email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
    typeof body.idempotencyKey !== "string" ||
    body.idempotencyKey.trim().length < 1 ||
    body.idempotencyKey.trim().length > 255
  ) {
    return Response.json(
      { error: "INVALID_INPUT" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const minecraftUsername = body.minecraftUsername.trim();
  const email = body.email.trim().toLowerCase();
  const idempotencyKey = body.idempotencyKey.trim();

  const db = getPrisma();

  try {
    if (body.type === "vip") {
      if (!body.rankSlug || typeof body.rankSlug !== "string") {
        return Response.json(
          { error: "INVALID_INPUT" },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }

      const validated = validateOrderInput({
        rankSlug: body.rankSlug,
        minecraftUsername,
        email,
      });

      if ("error" in validated) {
        return Response.json(
          { error: validated.error },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }

      const order = await createOrder(db, validated.data, {
        idempotencyKey,
      });

      const checkout = await startStripeCheckout(
        db,
        createStripeCheckoutClient(config.secretKey),
        { orderNumber: order.orderNumber, orderToken: order.paymentToken },
        { appUrl: new URL(process.env.APP_URL ?? "https://swiftmc.com.br") },
      );

      return Response.json(
        { checkoutUrl: checkout.checkoutUrl, orderNumber: order.orderNumber },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    // Coins purchase
    if (!body.coinsPackageId || typeof body.coinsPackageId !== "number") {
      return Response.json(
        { error: "INVALID_INPUT" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const pack = cashPackages.find((p) => p.amount === body.coinsPackageId);
    if (!pack) {
      return Response.json(
        { error: "UNKNOWN_PACKAGE" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const orderNumber = `SWIFT-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
    const publicToken = randomBytes(32).toString("base64url");
    const now = new Date();

    const order = await db.order.create({
      data: {
        publicToken,
        orderNumber,
        status: OrderStatus.PENDING_PAYMENT,
        rankSlug: `coins-${pack.amount}`,
        rankName: `${pack.amount} Cash`,
        rankDuration: "Único",
        minecraftUsername,
        email,
        currency: "BRL",
        subtotalCents: pack.price,
        discountCents: 0,
        totalCents: pack.price,
        checkoutIdempotencyKey: idempotencyKey,
        expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS),
      },
    });

    const checkout = await startStripeCheckout(
      db,
      createStripeCheckoutClient(config.secretKey),
      { orderNumber: order.orderNumber, orderToken: order.publicToken },
      { appUrl: new URL(process.env.APP_URL ?? "https://swiftmc.com.br") },
    );

    return Response.json(
      { checkoutUrl: checkout.checkoutUrl, orderNumber: order.orderNumber },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === "IdempotencyConflictError") {
        return Response.json(
          { error: "IDEMPOTENCY_CONFLICT" },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (error.name === "StripeUnavailableError") {
        return Response.json(
          { error: "PROVIDER_UNAVAILABLE" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }
    return Response.json(
      { error: "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
