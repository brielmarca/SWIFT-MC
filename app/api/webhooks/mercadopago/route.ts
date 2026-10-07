import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
  parseMercadoPagoWebhookEnvelope,
  reconcileMercadoPagoWebhook,
  verifyMercadoPagoSignature,
} from "@/lib/payments/mercado-pago-webhook";
import { createMercadoPagoOrdersClient } from "@/lib/payments/mercado-pago";
import { prisma } from "@/lib/prisma";
import { getDatabaseUrl, getMercadoPagoWebhookConfig } from "@/lib/server-env";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,255}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,255}$/;

function response(message: string, status: number, requestId: string) {
  return NextResponse.json(
    status < 300 ? { received: true } : { error: message, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const responseRequestId = randomUUID();
  const url = new URL(request.url);
  const providerOrderId = url.searchParams.get("data.id") ?? "";
  const queryType = url.searchParams.get("type") ?? "";
  const providerRequestId = request.headers.get("x-request-id") ?? "";
  const signature = request.headers.get("x-signature") ?? "";
  const declaredLength = Number(request.headers.get("content-length"));

  if (queryType !== "order") return response("Unsupported webhook type.", 200, responseRequestId);
  if (!RESOURCE_ID_PATTERN.test(providerOrderId) || !REQUEST_ID_PATTERN.test(providerRequestId)) {
    return response("Invalid webhook request.", 400, responseRequestId);
  }
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return response("Request body is too large.", 413, responseRequestId);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return response("Request body is too large.", 413, responseRequestId);
    }
    body = JSON.parse(rawBody);
  } catch {
    return response("Malformed webhook body.", 400, responseRequestId);
  }

  const envelope = parseMercadoPagoWebhookEnvelope(body);
  if (!envelope || envelope.data.id !== providerOrderId) {
    return response("Invalid webhook request.", 400, responseRequestId);
  }

  try {
    const config = getMercadoPagoWebhookConfig();
    if (!verifyMercadoPagoSignature(
      { providerOrderId, requestId: providerRequestId, signature },
      config.webhookSecret,
    )) {
      return response("Invalid webhook signature.", 401, responseRequestId);
    }

    getDatabaseUrl();
    await reconcileMercadoPagoWebhook(
      prisma,
      createMercadoPagoOrdersClient(config.accessToken),
      envelope,
      { providerOrderId, requestId: providerRequestId, signature },
    );
    return response("", 200, responseRequestId);
  } catch (error) {
    console.error("Mercado Pago webhook processing failed", {
      requestId: responseRequestId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return response("Webhook service is temporarily unavailable.", 503, responseRequestId);
  }
}
