import { getStripeWebhookConfig, stripeTestEventsOnly } from "@/lib/server-env";
import { getWorkersEnv } from "@/lib/auth-api/get-env";
import { withAuthPrisma } from "@/lib/auth-infrastructure/prisma";
import { createStripeClient } from "@/lib/payments/stripe";
import {
  parseStripeWebhookEvent,
  parseStripeSignature,
  verifyStripeSignature,
  reconcileStripeWebhook,
} from "@/lib/payments/stripe-webhook";

export async function POST(request: Request): Promise<Response> {
  let config: { secretKey: string; webhookSecret: string };
  try {
    config = getStripeWebhookConfig();
  } catch {
    return Response.json(
      { error: "WEBHOOK_CONFIG_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return Response.json(
      { error: "INVALID_REQUEST_BODY" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) {
    return Response.json(
      { error: "INVALID_SIGNATURE_HEADER" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const metadata = {
    eventId: "",
    timestamp: parsed.timestamp,
    signature: parsed.signature,
  };

  const signatureValid = await verifyStripeSignature(rawBody, metadata, config.webhookSecret);
  if (!signatureValid) {
    return Response.json(
      { error: "INVALID_SIGNATURE" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let event: { id: string; type: string; data: { object: unknown } };
  try {
    const payload = JSON.parse(rawBody);
    if (stripeTestEventsOnly() && payload.livemode !== false) {
      return Response.json({ error: "TEST_EVENTS_ONLY" }, { status: 400 });
    }
    const parsedEvent = parseStripeWebhookEvent(payload);
    if (!parsedEvent) {
      return Response.json(
        { error: "INVALID_EVENT_PAYLOAD" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    event = parsedEvent;
  } catch {
    return Response.json(
      { error: "INVALID_EVENT_PAYLOAD" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  metadata.eventId = event.id;

  // The Worker runtime has no DATABASE_URL; the database is reached only
  // through the Hyperdrive binding. Fail closed before any side effect.
  const env = await getWorkersEnv();
  if (!env.AUTH_HYPERDRIVE) {
    return Response.json(
      { error: "WEBHOOK_DATABASE_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const stripe = createStripeClient(config.secretKey, fetch);

  try {
    return await withAuthPrisma(env, async (db) => {
      const result = await reconcileStripeWebhook(db, stripe, event, metadata);
      const body: Record<string, boolean> = { received: true };
      if (result === "duplicate") body.duplicate = true;
      if (result === "ignored") body.ignored = true;
      if (result === "processed") body.processed = true;
      return Response.json(
        body,
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    if (error instanceof Error && error.name === "StripeUnavailableError") {
      return Response.json(
        { error: "PROVIDER_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    console.error("stripe-webhook-failure", error);
    return Response.json(
      { error: "INTERNAL_ERROR" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
