import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createMercadoPagoOrdersClient } from "@/lib/payments/mercado-pago";
import {
  OrderNotFoundError,
  OrderNotPayableError,
  startOrderPayment,
} from "@/lib/payments/start-payment";
import { prisma } from "@/lib/prisma";
import { getDatabaseUrl, getMercadoPagoConfig } from "@/lib/server-env";

export const runtime = "nodejs";

const orderNumberPattern = /^SWIFT-[0-9]{8}-[A-F0-9]{10}$/;
const paymentTokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

function errorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice(7).trim();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ orderNumber: string }> },
) {
  const requestId = randomUUID();
  const { orderNumber } = await context.params;
  const orderToken = bearerToken(request);

  if (!orderNumberPattern.test(orderNumber) || !orderToken || !paymentTokenPattern.test(orderToken)) {
    return errorResponse("Order not found.", 404, requestId);
  }

  try {
    getDatabaseUrl();
    const config = getMercadoPagoConfig();
    const checkout = await startOrderPayment(
      prisma,
      createMercadoPagoOrdersClient(config.accessToken),
      { orderNumber, orderToken },
      { appUrl: config.appUrl },
    );

    return NextResponse.json(checkout, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      return errorResponse("Order not found.", 404, requestId);
    }

    if (error instanceof OrderNotPayableError) {
      return errorResponse("This order cannot accept a payment.", 409, requestId);
    }

    console.error("Payment start failed", {
      requestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return errorResponse("Payment service is temporarily unavailable.", 503, requestId);
  }
}
