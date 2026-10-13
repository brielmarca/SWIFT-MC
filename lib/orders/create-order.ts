import { randomBytes, randomUUID } from "node:crypto";
import { OrderStatus, Prisma, type Order, type PrismaClient } from "@prisma/client";

import type { ValidatedOrderInput } from "@/lib/orders/order-input";

const ORDER_LIFETIME_MS = 30 * 60 * 1000;

export type PublicOrder = {
  orderNumber: string;
  paymentToken: string;
  status: OrderStatus;
  rank: {
    slug: string;
    name: string;
    duration: string;
  };
  totalCents: number;
  currency: string;
  expiresAt: string;
};

export class IdempotencyConflictError extends Error {
  constructor() {
    super("The idempotency key was already used for different order details.");
    this.name = "IdempotencyConflictError";
  }
}

function createOrderNumber(now: Date): string {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  return `SWIFT-${date}-${suffix}`;
}

function toPublicOrder(order: Order): PublicOrder {
  return {
    orderNumber: order.orderNumber,
    paymentToken: order.publicToken,
    status: order.status,
    rank: {
      slug: order.rankSlug,
      name: order.rankName,
      duration: order.rankDuration,
    },
    totalCents: order.totalCents,
    currency: order.currency,
    expiresAt: order.expiresAt.toISOString(),
  };
}

function matchesOrderInput(order: Order, input: ValidatedOrderInput): boolean {
  return (
    order.rankSlug === input.rank.slug &&
    order.minecraftUsername === input.minecraftUsername &&
    order.email === input.email
  );
}

export async function createOrder(
  db: PrismaClient,
  input: ValidatedOrderInput,
  options: { idempotencyKey?: string; now?: Date } = {},
): Promise<PublicOrder> {
  const now = options.now ?? new Date();
  const idempotencyKey = options.idempotencyKey ?? `server-${randomUUID()}`;
  const { rank, minecraftUsername, email } = input;
  const totalCents = rank.priceCents;

  const existingOrder = await db.order.findUnique({
    where: { checkoutIdempotencyKey: idempotencyKey },
  });

  if (existingOrder) {
    if (!matchesOrderInput(existingOrder, input)) {
      throw new IdempotencyConflictError();
    }

    return toPublicOrder(existingOrder);
  }

  try {
    const order = await db.order.create({
      data: {
        publicToken: randomBytes(32).toString("base64url"),
        orderNumber: createOrderNumber(now),
        status: OrderStatus.PENDING_PAYMENT,
        rankSlug: rank.slug,
        rankName: rank.name,
        rankDuration: rank.duration,
        minecraftUsername,
        email,
        currency: "BRL",
        subtotalCents: rank.priceCents,
        discountCents: 0,
        totalCents,
        checkoutIdempotencyKey: idempotencyKey,
        expiresAt: new Date(now.getTime() + ORDER_LIFETIME_MS),
      },
    });

    return toPublicOrder(order);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const concurrentOrder = await db.order.findUnique({
      where: { checkoutIdempotencyKey: idempotencyKey },
    });

    if (!concurrentOrder) {
      throw error;
    }

    if (!matchesOrderInput(concurrentOrder, input)) {
      throw new IdempotencyConflictError();
    }

    return toPublicOrder(concurrentOrder);
  }
}