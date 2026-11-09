# Stripe Integration — Swift MC Store

## Overview

Stripe Checkout is integrated as a second payment provider alongside Mercado Pago. The integration consists of:

1. **Checkout Session creation** — `POST /api/checkout/stripe` (blocked behind `demoCommerceBlocked`, library in `lib/payments/stripe-checkout.ts`)
2. **Webhook endpoint** — `POST /api/webhooks/stripe` (verifies signatures, reconciles with Stripe API, updates orders/payments)
3. **Stripe API client** — `lib/payments/stripe.ts` (reconciliation: get checkout sessions, invoices, subscriptions, charges)

## Architecture

### Payment flow

```
Browser
  -> POST /api/orders          (create local order, server-priced)
  <- orderNumber, publicToken
Browser
  -> POST /api/checkout/stripe (create Stripe Checkout Session)
  <- checkoutUrl
Browser
  -> redirect to Stripe Checkout
Stripe
  -> POST /api/webhooks/stripe (webhook notification)
Webhook handler
  -> verify Stripe signature (raw body + stripe-signature header)
  -> deduplicate via PaymentEvent (unique deduplicationKey)
  -> fetch resource from Stripe API (server-only secret key)
  -> validate orderNumber, amount, currency against local Order
  -> update Payment + Order in one transaction (monotonic transitions)
  <- 200 acknowledgement
Browser
  -> GET /api/orders/[publicToken] (read-only status page)
```

### Supported event types

| Stripe event | Meaning | Local effect |
|---|---|---|
| `checkout.session.completed` | One-time payment completed | Payment → APPROVED, Order → PAID |
| `checkout.session.async_payment_succeeded` | Async one-time payment succeeded | Payment → APPROVED, Order → PAID |
| `checkout.session.async_payment_failed` | Async one-time payment failed | Payment → REJECTED, Order → PAYMENT_FAILED |
| `invoice.paid` | Subscription invoice paid | Payment → APPROVED, Order → PAID |
| `invoice.payment_failed` | Subscription invoice failed | Payment → REJECTED, Order → PAYMENT_FAILED |
| `customer.subscription.updated` | Subscription status changed | Payment status mapped, Order preserved if PAID |
| `customer.subscription.deleted` | Subscription cancelled | Payment → CANCELLED, Order stays PAID |
| `charge.refunded` | Charge refunded | Payment → REFUNDED, Order → REFUNDED |

### Product types

- **Monthly VIP subscriptions** — Stripe Checkout in `subscription` mode with `recurring.interval = month`. Rank slugs from `data/ranks.ts` (`swift`, `eclipse`, `cosmic`, `overdrive`).
- **One-time Coins purchases** — Stripe Checkout in `payment` mode. Cash packages from `data/cash-packages.ts`.

### Idempotency & duplicate prevention

- `PaymentEvent.deduplicationKey` has a unique DB constraint (SHA-256 of `stripe\0<eventId>`)
- Duplicate webhooks are acknowledged without side effects
- `Payment.providerOrderId` and `Payment.providerPaymentId` are unique
- Order/payment/event updates happen in one database transaction
- Stale events cannot downgrade PAID/FULFILLED/REFUNDED orders

### Security

- Signature verified against exact raw request body using HMAC-SHA-256 (Web Crypto API)
- Timestamp tolerance: 5 minutes (replay protection)
- Constant-time signature comparison
- All secrets server-side only (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- No `NEXT_PUBLIC_*` Stripe variables
- Order amount/currency validated against Stripe API response (never trusted from webhook payload alone)
- Cloudflare Workers compatible (no `node:crypto` dependencies)

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Stripe API authentication (`sk_test_*` or `sk_live_*`) |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signature verification (`whsec_*`) |

Add to `.env` (never commit real values):

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Database Migration

Migration: `prisma/migrations/20261106000000_add_stripe_provider/migration.sql`

```sql
ALTER TYPE "PaymentProvider" ADD VALUE 'STRIPE';
```

Apply with:

```bash
npx prisma migrate deploy
```

Or for development:

```bash
npx prisma migrate dev
```

The `Payment` model's `provider` field now accepts `STRIPE` alongside `MERCADO_PAGO`. Existing Mercado Pago data is unaffected.

## Cloudflare Worker Configuration

Add secret bindings in `cloudflare.config.ts`:

```ts
STRIPE_SECRET_KEY: bindings.secret(),
STRIPE_WEBHOOK_SECRET: bindings.secret(),
```

Add type declarations in `cloudflare-workers.d.ts`:

```ts
STRIPE_SECRET_KEY?: string;
STRIPE_WEBHOOK_SECRET?: string;
```

Configure these as runtime Secrets in the Cloudflare dashboard or via Wrangler:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

## Stripe Dashboard Configuration

1. Create a Stripe application in the [Stripe Dashboard](https://dashboard.stripe.com/)
2. Obtain `STRIPE_SECRET_KEY` from Developers > API keys
3. Create a webhook endpoint:
   - URL: `https://swiftmc.com.br/api/webhooks/stripe`
   - Events to enable:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `charge.refunded`
4. Obtain `STRIPE_WEBHOOK_SECRET` from the webhook endpoint settings (`whsec_...`)

## Minecraft Fulfillment Status

**No Minecraft fulfillment API exists in the codebase.** The following was verified:

- `lib/minecraft-data/client.ts` — read-only transport for player stats, leaderboards, online players only
- `lib/minecraft-profile-server.ts` — Mojang profile lookup (username → UUID), read-only
- No `lib/fulfillment/` directory exists
- No grant/revoke/coins API endpoint exists

### Current behavior

When a Stripe webhook confirms payment:
1. `Order.status` transitions to `PAID`
2. `Payment.status` transitions to `APPROVED`
3. A `Fulfillment` record is **not** created automatically (following the existing Phase 4B Mercado Pago pattern)
4. The order remains in `PAID` state awaiting manual or future automated fulfillment

### What is missing for automated fulfillment

- A Minecraft bridge/plugin that exposes `grantRank(fulfillmentId, username, rankSlug)` or `grantCoins(fulfillmentId, username, amount)`
- `MINECRAFT_FULFILLMENT_URL` and `MINECRAFT_FULFILLMENT_TOKEN` environment variables
- A fulfillment worker that claims `Fulfillment` rows and calls the bridge
- Rank slug → server permission/group mappings
- Coins amount → economy command mappings

Until these are implemented, orders remain in `PAID` with fulfillment pending. This is safe — no products are granted without explicit fulfillment logic, and no duplicate delivery can occur.

## Testing

### Test files

- `tests/integration/stripe-webhook.test.ts` — webhook signature verification, all 8 event types, idempotency, mismatches, stale events, provider outages
- `tests/payments/stripe-checkout.test.ts` — Checkout Session creation (subscription and one-time modes), order validation, expired/non-payable rejection, provider unavailability

### Running tests

Integration tests require a PostgreSQL test database:

```bash
# Start test database
npm run test:db

# Run Stripe webhook tests
DATABASE_URL="postgresql://swiftmc_test@localhost:5433/swiftmc_test?host=/tmp/swiftmc-pg-test-xxx" \
DIRECT_DATABASE_URL="postgresql://swiftmc_test@localhost:5433/swiftmc_test?host=/tmp/swiftmc-pg-test-xxx" \
STRIPE_SECRET_KEY="sk_test_..." \
STRIPE_WEBHOOK_SECRET="whsec_..." \
npm test -- tests/integration/stripe-webhook.test.ts tests/payments/stripe-checkout.test.ts
```

### Typecheck and lint

```bash
npx tsc --noEmit
npx eslint .
```

## Remaining Manual Steps

1. **Database**: Run `npx prisma migrate deploy` to add `STRIPE` to `PaymentProvider` enum
2. **Cloudflare secrets**: Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker runtime secrets
3. **Stripe Dashboard**: Create webhook endpoint pointing to `https://swiftmc.com.br/api/webhooks/stripe` and enable all 8 event types
4. **Minecraft fulfillment**: Deploy a Minecraft bridge with rank/coins grant API, then implement fulfillment worker
5. **Frontend integration**: Connect store checkout buttons to `POST /api/checkout/stripe` when demo mode is disabled
6. **Remove demo block**: Replace `demoCommerceBlocked` on `app/api/checkout/stripe/route.ts` with the actual `startStripeCheckoutHandler` when payments are enabled

## Files

### Created

| File | Purpose |
|---|---|
| `app/api/checkout/stripe/route.ts` | Stripe Checkout Session creation endpoint |
| `app/api/webhooks/stripe/route.ts` | Stripe webhook endpoint |
| `lib/payments/stripe-checkout.ts` | Stripe Checkout Session creation library |
| `lib/payments/stripe-webhook.ts` | Stripe webhook signature verification & reconciliation |
| `lib/payments/stripe.ts` | Stripe API reconciliation client |
| `prisma/migrations/20261106000000_add_stripe_provider/migration.sql` | Add `STRIPE` to `PaymentProvider` enum |
| `tests/integration/stripe-webhook.test.ts` | Webhook integration tests |
| `tests/payments/stripe-checkout.test.ts` | Checkout creation tests |
| `docs/stripe-integration.md` | This document |

### Modified

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `STRIPE` to `PaymentProvider` enum |
| `.env.example` | Added `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` |
| `lib/server-env.ts` | Added `getStripeConfig()` and `getStripeWebhookConfig()` |
| `cloudflare.config.ts` | Added Stripe secret bindings |
| `cloudflare-workers.d.ts` | Added Stripe env type declarations |
