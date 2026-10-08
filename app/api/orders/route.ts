import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createOrder, IdempotencyConflictError } from "@/lib/orders/create-order";
import { validateOrderInput } from "@/lib/orders/order-input";
import { prisma } from "@/lib/prisma";
import { getDatabaseUrl } from "@/lib/server-env";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

function errorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const declaredLength = Number(request.headers.get("content-length"));
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();

  if (!idempotencyKey || !idempotencyKeyPattern.test(idempotencyKey)) {
    return errorResponse("A valid Idempotency-Key header is required.", 400, requestId);
  }

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse("Request body is too large.", 413, requestId);
  }

  let body: unknown;

  try {
    const rawBody = await request.text();

    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return errorResponse("Request body is too large.", 413, requestId);
    }

    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Malformed JSON body.", 400, requestId);
  }

  const validated = validateOrderInput(body);

  if (!validated.data && validated.error === "UNKNOWN_RANK") {
    return errorResponse("Rank not found.", 404, requestId);
  }

  if (!validated.data && validated.error === "UNPRICED_RANK") {
    return errorResponse("Rank not available for purchase.", 400, requestId);
  }

  if (!validated.data) {
    return errorResponse("Invalid order details.", 400, requestId);
  }

  try {
    getDatabaseUrl();
    const order = await createOrder(prisma, validated.data, { idempotencyKey });

    return NextResponse.json(order, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return errorResponse("This request key was already used for different order details.", 409, requestId);
    }

    console.error("Order creation failed", {
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });

    return errorResponse("Order service is temporarily unavailable.", 503, requestId);
  }
}