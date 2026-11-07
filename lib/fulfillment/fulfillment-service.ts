import "server-only";

import {
  FulfillmentStatus,
  OrderStatus,
  type PrismaClient,
  type Fulfillment,
  type Order,
} from "@prisma/client";

import {
  createMinecraftGrantClient,
  getMinecraftGrantConfig,
  type GrantResult,
} from "@/lib/minecraft/grant-client";

const MAX_ATTEMPTS = 6;
const INITIAL_RETRY_DELAY_MS = 60_000;
const MAX_RETRY_DELAY_MS = 3_600_000;

export type FulfillmentProcessResult =
  | { status: "granted" }
  | { status: "already_granted" }
  | { status: "not_found"; reason: string }
  | { status: "retry"; nextAttemptAt: Date }
  | { status: "dead_letter"; lastErrorCode: string };

export class FulfillmentServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "FulfillmentServiceError";
  }
}

export function isFulfillmentEnabled(): boolean {
  return getMinecraftGrantConfig() !== null;
}

export async function createFulfillmentForOrder(
  db: PrismaClient,
  order: { id: string; orderNumber: string; rankSlug: string; rankName: string; minecraftUsername: string; totalCents: number; currency: string },
  type: "rank" | "coins",
  coinsAmount?: number,
): Promise<{ fulfillment: Fulfillment; created: boolean }> {
  const existing = await db.fulfillment.findUnique({
    where: { orderId: order.id },
  });

  if (existing) {
    return { fulfillment: existing, created: false };
  }

  let rankSlug = order.rankSlug;
  const minecraftUsername = order.minecraftUsername;

  if (type === "coins" && coinsAmount) {
    rankSlug = `coins-${coinsAmount}`;
  }

  const fulfillment = await db.fulfillment.create({
    data: {
      orderId: order.id,
      status: FulfillmentStatus.PENDING,
      rankSlug,
      minecraftUsername,
    },
  });

  return { fulfillment, created: true };
}

function calculateNextAttempt(attemptCount: number): Date {
  const delayMs = Math.min(
    INITIAL_RETRY_DELAY_MS * Math.pow(2, attemptCount),
    MAX_RETRY_DELAY_MS,
  );
  return new Date(Date.now() + delayMs);
}

function mapGrantResultToFulfillmentStatus(
  result: GrantResult,
): { status: FulfillmentStatus; orderStatus?: OrderStatus; lastErrorCode?: string; providerReference?: string } {
  switch (result.status) {
    case "granted":
      return {
        status: FulfillmentStatus.SUCCEEDED,
        orderStatus: OrderStatus.FULFILLED,
        providerReference: result.reference,
      };
    case "already_granted":
      return {
        status: FulfillmentStatus.SUCCEEDED,
        orderStatus: OrderStatus.FULFILLED,
        providerReference: result.reference,
      };
    case "not_found":
      return {
        status: FulfillmentStatus.FAILED,
        lastErrorCode: "PLAYER_NOT_FOUND",
      };
    case "unavailable":
      return {
        status: FulfillmentStatus.RETRY_PENDING,
        lastErrorCode: "MINECRAFT_UNAVAILABLE",
      };
  }
}

export async function processFulfillment(
  db: PrismaClient,
  fulfillment: Fulfillment & { order: Order },
  grantClient: ReturnType<typeof createMinecraftGrantClient>,
  now: Date = new Date(),
): Promise<FulfillmentProcessResult> {
  // Atomic claim: only process if PENDING or RETRY_PENDING and nextAttemptAt is due
  const updated = await db.fulfillment.updateMany({
    where: {
      id: fulfillment.id,
      status: {
        in: [FulfillmentStatus.PENDING, FulfillmentStatus.RETRY_PENDING],
      },
      ...(fulfillment.status === FulfillmentStatus.RETRY_PENDING
        ? { nextAttemptAt: { lte: now } }
        : {}),
    },
    data: {
      status: FulfillmentStatus.PROCESSING,
      lockedAt: now,
      attemptCount: { increment: 1 },
    },
  });

  if (updated.count !== 1) {
    return { status: "retry", nextAttemptAt: fulfillment.nextAttemptAt ?? now };
  }

  const config = getMinecraftGrantConfig();
  if (!config) {
    await db.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.RETRY_PENDING,
        nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
        lastErrorCode: "MINECRAFT_NOT_CONFIGURED",
      },
    });
    return {
      status: "retry",
      nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
    };
  }

  let result: GrantResult;
  try {
    if (fulfillment.rankSlug.startsWith("coins-")) {
      const amount = parseInt(fulfillment.rankSlug.replace("coins-", ""), 10);
      result = await grantClient.grantCoins(
        fulfillment.id,
        fulfillment.minecraftUsername,
        amount,
      );
    } else {
      result = await grantClient.grantRank(
        fulfillment.id,
        fulfillment.minecraftUsername,
        fulfillment.rankSlug,
      );
    }
  } catch {
    await db.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.RETRY_PENDING,
        nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
        lastErrorCode: "MINECRAFT_REQUEST_FAILED",
      },
    });
    return {
      status: "retry",
      nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
    };
  }

  const mapping = mapGrantResultToFulfillmentStatus(result);
  const isPermanentFailure =
    mapping.status === FulfillmentStatus.FAILED ||
    fulfillment.attemptCount + 1 >= MAX_ATTEMPTS;

  if (isPermanentFailure && mapping.status !== FulfillmentStatus.SUCCEEDED) {
    const finalStatus =
      mapping.status === FulfillmentStatus.FAILED
        ? FulfillmentStatus.FAILED
        : FulfillmentStatus.FAILED;
    const finalErrorCode =
      mapping.lastErrorCode ?? (fulfillment.attemptCount + 1 >= MAX_ATTEMPTS
        ? "MAX_ATTEMPTS_EXCEEDED"
        : mapping.lastErrorCode);

    await db.fulfillment.update({
      where: { id: fulfillment.id },
      data: {
        status: finalStatus,
        lastErrorCode: finalErrorCode,
        providerReference: mapping.providerReference ?? null,
      },
    });

    return {
      status: mapping.status === FulfillmentStatus.FAILED ? "not_found" : "dead_letter",
      reason: mapping.lastErrorCode ?? "unknown",
      lastErrorCode: finalErrorCode,
    } as FulfillmentProcessResult;
  }

  if (mapping.status === FulfillmentStatus.SUCCEEDED) {
    await db.$transaction(async (tx) => {
      await tx.fulfillment.update({
        where: { id: fulfillment.id },
        data: {
          status: FulfillmentStatus.SUCCEEDED,
          fulfilledAt: now,
          providerReference: mapping.providerReference ?? null,
          lastErrorCode: null,
        },
      });
      await tx.order.update({
        where: { id: fulfillment.orderId },
        data: { status: OrderStatus.FULFILLED },
      });
    });

    return {
      status: result.status === "already_granted" ? "already_granted" : "granted",
    };
  }

  // RETRY_PENDING
  await db.fulfillment.update({
    where: { id: fulfillment.id },
    data: {
      status: FulfillmentStatus.RETRY_PENDING,
      nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
      lastErrorCode: mapping.lastErrorCode,
      providerReference: mapping.providerReference ?? null,
    },
  });

  return {
    status: "retry",
    nextAttemptAt: calculateNextAttempt(fulfillment.attemptCount + 1),
  };
}

export async function processPendingFulfillments(
  db: PrismaClient,
  grantClient: ReturnType<typeof createMinecraftGrantClient>,
  now: Date = new Date(),
): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
  const due = await db.fulfillment.findMany({
    where: {
      status: {
        in: [FulfillmentStatus.PENDING, FulfillmentStatus.RETRY_PENDING],
      },
      ...(now ? { nextAttemptAt: { lte: now } } : {}),
    },
    include: { order: true },
    orderBy: { nextAttemptAt: "asc" },
  });

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let retried = 0;

  for (const fulfillment of due) {
    processed += 1;
    const result = await processFulfillment(db, fulfillment, grantClient, now);

    switch (result.status) {
      case "granted":
      case "already_granted":
        succeeded += 1;
        break;
      case "not_found":
        failed += 1;
        break;
      case "dead_letter":
        failed += 1;
        break;
      case "retry":
        retried += 1;
        break;
    }
  }

  return { processed, succeeded, failed, retried };
}

export async function getFulfillmentStats(db: PrismaClient) {
  const [pending, processing, succeeded, failed, retryPending] =
    await Promise.all([
      db.fulfillment.count({ where: { status: FulfillmentStatus.PENDING } }),
      db.fulfillment.count({ where: { status: FulfillmentStatus.PROCESSING } }),
      db.fulfillment.count({ where: { status: FulfillmentStatus.SUCCEEDED } }),
      db.fulfillment.count({ where: { status: FulfillmentStatus.FAILED } }),
      db.fulfillment.count({ where: { status: FulfillmentStatus.RETRY_PENDING } }),
    ]);

  return { pending, processing, succeeded, failed, retryPending };
}
