# MVP Backend Architecture

## Scope and decisions

This document defines the first production backend for SWIFT MC rank purchases and records the API contract implemented so far.

The MVP uses:

- PostgreSQL as the system of record.
- Prisma for schema migrations and database access.
- Mercado Pago Checkout Pro through the Orders API for hosted PIX and credit-card payment entry.
- A server-side fulfillment worker that grants the purchased rank through a private Minecraft integration.
- The existing Next.js application for server-side API route handlers and order status pages.

Checkout Pro is preferred over collecting card details in the SWIFT MC application. Mercado Pago hosts the sensitive payment UI, while this application creates a preference and redirects the buyer to it. No card number, CVV, PIX credential, payment token, or Minecraft credential is stored by or sent through the browser application.

Not included in the MVP:

- User accounts or authentication.
- Shopping carts or orders containing multiple ranks.
- Recurring billing.
- Refund initiation from the SWIFT MC UI.
- A database-backed product administration interface.
- A general-purpose message broker. PostgreSQL provides the initial durable fulfillment queue.
- Coupon support. The current coupon control remains disabled until a server-side coupon model and validation rules are designed.

## Current frontend context

The storefront now has the first checkout backend phases implemented:

- `data/ranks.ts` defines rank slugs, names, integer-cent prices, durations, and benefits.
- `POST /api/orders` validates checkout input and persists an idempotent, server-priced local order.
- `POST /api/orders/[orderNumber]/payment` authenticates the request with the order bearer token, creates one Mercado Pago order, and persists its checkout URL and provider order ID.
- Browser return pages under `/checkout/return/[result]` are informational and never mutate payment state.
- Prisma models and PostgreSQL migrations persist orders, payments, payment events, and the future fulfillment queue.

The backend implementation must preserve the rank slug as the product identifier, but must not parse or trust the formatted `price` string currently rendered by the client. Before payments are enabled, the shared catalog should expose a server-authoritative `priceCents` integer for each rank and derive the formatted BRL display value from it. This keeps one product catalog while making integer cents the source of truth.

## Core invariants

These rules are mandatory across every phase:

1. The client sends a rank slug, Minecraft username, email, and a request idempotency key. It never sends an authoritative price, discount, total, payment status, or fulfillment status.
2. All monetary values are stored as integer cents. Floating-point values are never persisted or used for price comparison.
3. The server resolves the rank and price from the server-authoritative catalog at order creation time and snapshots them onto the order.
4. An order is paid only after a valid Mercado Pago webhook is received and the payment is fetched from Mercado Pago's API with server credentials.
5. Return URLs, query parameters, browser redirects, the success page, and client requests never mark an order paid.
6. Webhook receipt and processing are idempotent. Duplicate and out-of-order notifications are expected.
7. Fulfillment is attempted only for a verified, approved payment whose external reference, currency, and amount match the local order.
8. Mercado Pago access tokens, webhook secrets, database credentials, and Minecraft credentials remain server-only.

## High-level flow

```text
Browser
  -> POST /api/orders
Next.js server
  -> validate input
  -> resolve rank and price on server
  -> create local Order
  <- return order number, public order token, and expiry
Browser
  -> POST /api/orders/{orderNumber}/payment with order token
Next.js server
  -> create Mercado Pago order with orderNumber as external_reference
  -> save Payment/provider order identifiers and checkout URL
  <- return Mercado Pago checkout URL
Browser
  -> redirect to hosted Mercado Pago checkout

Mercado Pago
  -> POST /api/webhooks/mercadopago?data.id={providerOrderId}&type=order
Webhook handler
  -> verify signature
  -> persist/deduplicate PaymentEvent
  -> fetch GET /v1/orders/{providerOrderId}
  -> validate external_reference, amount, and BRL currency
  -> update Payment and Order in one transaction
  <- acknowledge notification

Browser
  -> GET /api/orders/{publicToken}
  <- sanitized order/payment/activation status
```

## Data model

IDs may use Prisma `String @id @default(cuid())` for simple application-generated identifiers. Provider identifiers remain strings because Mercado Pago IDs should not be assumed to fit a JavaScript integer. Every timestamp maps to PostgreSQL `timestamptz` and is stored in UTC.

### Order

Represents the commercial intent and immutable purchase snapshot.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Internal primary key; never used as the only browser authorization value. |
| `publicToken` | string | Cryptographically random, unique, unguessable token used by the unauthenticated status page. Store as a hash if operationally practical; otherwise treat it as a bearer secret. |
| `orderNumber` | string | Unique human-readable reference such as `SWIFT-...`; display only, not authorization. |
| `status` | `OrderStatus` | Current aggregate order state. |
| `rankSlug` | string | Validated catalog key: `vip`, `vip-plus`, or `mvp`. |
| `rankName` | string | Snapshot of the purchased display name. |
| `minecraftUsername` | string | Trimmed and validated username to fulfill. Preserve submitted casing if the server integration needs it. |
| `email` | string | Trimmed and normalized for receipts/support. Never returned by the public status endpoint. |
| `currency` | string | Fixed to `BRL` for the MVP. |
| `subtotalCents` | integer | Server catalog price snapshot. Must be non-negative. |
| `discountCents` | integer | `0` in the MVP. Must be non-negative and no greater than subtotal. |
| `totalCents` | integer | Computed server-side as subtotal minus discount. Must be positive. |
| `checkoutIdempotencyKey` | string | Unique key for safe checkout creation retries. |
| `expiresAt` | timestamp | Time after which an unpaid order is considered expired. |
| `paidAt` | timestamp nullable | Set only by verified webhook processing. |
| `createdAt` | timestamp | Creation time. |
| `updatedAt` | timestamp | Last update time. |

Relations:

- One `Order` has one or more `Payment` attempts.
- One `Order` has zero or one `Fulfillment` in the MVP.

Important constraints and indexes:

- Unique: `publicToken`, `orderNumber`, `checkoutIdempotencyKey`.
- Index: `(status, createdAt)` for expiration and support queries.
- Index: `minecraftUsername` for support lookup.
- Database checks should enforce non-negative monetary values, `discountCents <= subtotalCents`, `totalCents = subtotalCents - discountCents`, and `currency = 'BRL'`. Prisma migrations may add these checks with migration SQL if the schema DSL cannot express them.

`rankName`, prices, and currency are snapshots. Later catalog price changes must not alter existing orders.

### Payment

Represents the single Mercado Pago Orders API checkout attempt for a local order and its latest verified provider state. The provider order ID and any payment transaction ID are separate identifiers.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Internal primary key. |
| `orderId` | string | Foreign key to `Order`. |
| `provider` | `PaymentProvider` | `MERCADO_PAGO`. |
| `status` | `PaymentStatus` | Normalized local state. |
| `providerOrderId` | string nullable | Mercado Pago Orders API order ID. Unique when present. |
| `providerIdempotencyKey` | string nullable | Stable server-derived key used to create the provider order. Unique when present. |
| `checkoutUrl` | string nullable | Validated Mercado Pago hosted checkout URL. |
| `preferenceId` | string nullable | Legacy unused field; Orders API checkout does not create preferences. |
| `providerPaymentId` | string nullable | Mercado Pago payment ID. Unique when present. |
| `providerStatus` | string nullable | Raw provider status for diagnosis and future mapping changes. |
| `providerStatusDetail` | string nullable | Raw provider detail, if supplied. |
| `paymentMethod` | string nullable | Provider method such as PIX or credit card; informational only. |
| `amountCents` | integer nullable | Amount fetched from Mercado Pago, converted exactly to cents. |
| `currency` | string nullable | Currency fetched from Mercado Pago. |
| `approvedAt` | timestamp nullable | Provider approval timestamp. |
| `lastSyncedAt` | timestamp nullable | Last successful provider fetch. |
| `createdAt` | timestamp | Creation time. |
| `updatedAt` | timestamp | Last update time. |

Important constraints and indexes:

- Unique: `providerOrderId`, `providerIdempotencyKey`, and `providerPaymentId` when present.
- Index: `(orderId, createdAt)`.
- Payment start creates exactly one `Payment` row for the local order attempt before calling Mercado Pago. Webhook reconciliation updates that row and never creates a second payment.
- Raw responses are not required in `Payment`; the append-only `PaymentEvent` preserves the notification audit trail without making a mutable JSON blob the source of truth.

### PaymentEvent

An append-only inbox/audit record for each provider notification. It enables deduplication, retries, and diagnosis.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Internal primary key. |
| `provider` | `PaymentProvider` | `MERCADO_PAGO`. |
| `deduplicationKey` | string | Unique stable key derived from verified notification identity; see idempotency section. |
| `providerEventId` | string nullable | Provider request/event ID when available. |
| `providerResourceId` | string | Payment/resource ID announced by Mercado Pago. |
| `eventType` | string | Raw topic/action, such as a payment update. |
| `signatureValid` | boolean | Whether origin validation succeeded. Invalid attempts may instead be logged and rejected without retaining their body. |
| `payload` | JSON | Minimal received payload required for audit; redact or omit unnecessary personal/payment data. |
| `status` | `PaymentEventStatus` | Processing state. |
| `attemptCount` | integer | Starts at zero and increments per processing attempt. |
| `nextAttemptAt` | timestamp nullable | Retry schedule. |
| `processedAt` | timestamp nullable | Successful completion time. |
| `lastErrorCode` | string nullable | Sanitized internal category, not a secret-bearing stack trace. |
| `createdAt` | timestamp | Receipt time. |
| `updatedAt` | timestamp | Last processing update. |

Important constraints and indexes:

- Unique: `deduplicationKey`.
- Index: `(status, nextAttemptAt)` for retry claims.
- Index: `providerResourceId` for audit/support lookup.
- Retain events long enough for payment disputes and operational diagnosis according to the final data-retention policy.

### Fulfillment

Represents the durable request to grant a rank in Minecraft. This table is both the fulfillment record and the MVP PostgreSQL-backed work queue.

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Internal primary key and downstream idempotency key. |
| `orderId` | string | Unique foreign key to `Order`; one fulfillment per MVP order. |
| `status` | `FulfillmentStatus` | Delivery state. |
| `rankSlug` | string | Rank snapshot copied from the order. |
| `minecraftUsername` | string | Target snapshot copied from the order. |
| `attemptCount` | integer | Incremented whenever the worker claims an attempt. |
| `nextAttemptAt` | timestamp nullable | Next eligible retry time. |
| `lockedAt` | timestamp nullable | Worker lease start for recovering abandoned work. |
| `lastErrorCode` | string nullable | Sanitized error category. |
| `providerReference` | string nullable | Non-secret command/job/audit reference returned by the Minecraft integration. |
| `fulfilledAt` | timestamp nullable | Successful grant time. |
| `createdAt` | timestamp | Creation time. |
| `updatedAt` | timestamp | Last update time. |

Important constraints and indexes:

- Unique: `orderId`.
- Index: `(status, nextAttemptAt)` for worker claims.
- `Fulfillment` is created in the same database transaction that moves an order to `PAID`, using create-if-absent semantics.

## Status enums and lifecycle

### OrderStatus

| Status | Meaning |
| --- | --- |
| `PENDING_PAYMENT` | Local order and payment preference exist; no verified approval has been observed. |
| `PAID` | A verified Mercado Pago API response confirms `processed`/`accredited` and an exact local order match. Fulfillment is not created until a later phase. |
| `FULFILLED` | Minecraft rank assignment was confirmed. Terminal success. |
| `PAYMENT_FAILED` | Provider reports a terminal rejection/cancellation for the relevant attempt. A later new attempt may return the order to `PENDING_PAYMENT`. |
| `EXPIRED` | No approved payment arrived before order/preference expiry. |
| `REFUNDED` | A later verified provider event reports a full refund. Rank revocation is a manual support process in the MVP. |
| `REVIEW_REQUIRED` | Provider data conflicts with the local order or a chargeback/refund requires operator review. |

Normal transitions:

```text
PENDING_PAYMENT -> PAID -> FULFILLED
PENDING_PAYMENT -> PAYMENT_FAILED
PENDING_PAYMENT -> EXPIRED
PAID | FULFILLED -> REFUNDED
any nonterminal state -> REVIEW_REQUIRED on invariant mismatch
```

State transitions are monotonic except for explicitly handled provider reversals. An old `pending` webhook must never downgrade `PAID` or `FULFILLED`.

### PaymentStatus

| Status | Meaning |
| --- | --- |
| `CREATED` | Preference/local payment record created; no provider payment state known. |
| `PENDING` | Provider payment exists but has not reached a terminal result. |
| `APPROVED` | Provider confirms approved and local amount/reference validation passed. |
| `REJECTED` | Provider rejected the payment. |
| `CANCELLED` | Provider or payer cancelled the payment. |
| `REFUNDED` | Provider confirms a full refund. |
| `CHARGED_BACK` | Provider reports a chargeback. |
| `REVIEW_REQUIRED` | Provider response cannot safely map to the local order. |

Raw Mercado Pago statuses remain in `providerStatus`; mapping code converts them to this deliberately small enum.

### PaymentEventStatus

| Status | Meaning |
| --- | --- |
| `RECEIVED` | Signature accepted and event durably stored. |
| `PROCESSING` | A worker/request owns a time-limited processing lease. |
| `PROCESSED` | Provider resource was fetched and local state was reconciled. |
| `RETRY_PENDING` | A transient failure occurred and another attempt is scheduled. |
| `DEAD_LETTER` | Retry limit exceeded or failure is permanently invalid. Requires review. |
| `IGNORED` | Valid duplicate, unsupported event type, or harmless stale update. |

### FulfillmentStatus

| Status | Meaning |
| --- | --- |
| `PENDING` | Durable fulfillment created and ready to claim. |
| `PROCESSING` | Worker holds a time-limited lease. |
| `SUCCEEDED` | Minecraft integration confirmed the rank is granted. |
| `RETRY_PENDING` | Transient delivery failure; retry scheduled. |
| `FAILED` | Permanent validation failure or retry limit exhausted. Manual review required. |

## API routes

All responses use generic public errors and structured server logs with a request/correlation ID. No route returns secrets, raw provider payloads, full email addresses, or database IDs unnecessarily.

### `POST /api/orders`

Creates one local order. It does not contact Mercado Pago.

Client input:

- `rankSlug`
- `minecraftUsername`
- `email`
- An `Idempotency-Key` header is required.

The client must not submit `price`, `subtotal`, `discount`, `total`, `currency`, or payment status. If supplied, these fields are ignored or rejected.

Server behavior:

1. Apply IP-based rate limiting and request size limits.
2. Validate the input schema. Revalidate username and email on the server even though the UI validates them.
3. Resolve `rankSlug` in the server catalog and obtain `priceCents`.
4. Create the order snapshot in `PENDING_PAYMENT` with `discountCents = 0` and `currency = BRL`.
5. Return only the order number, public order token, status, and expiry.

If the same checkout idempotency key is retried with the same normalized input, return the existing result. If it is reused with different input, return `409 Conflict`.

### `POST /api/orders/[orderNumber]/payment`

Starts hosted checkout for an existing local order. The route requires `Authorization: Bearer <publicToken>`, accepts no client price or payment state, derives a stable provider idempotency key from the local order ID, and sends persisted amount, currency, rank, email, and order number to Mercado Pago. It persists `providerOrderId` and a validated Mercado Pago `checkoutUrl`, and safely returns the existing URL on retries.

### `POST /api/webhooks/mercadopago`

Receives Mercado Pago notifications. This endpoint is public to Mercado Pago but is not trusted merely because it is public.

Server behavior:

1. Read `data.id` and `type` from the query string plus `x-request-id` and `x-signature` from headers. Validate the current Mercado Pago manifest with `MERCADOPAGO_WEBHOOK_SECRET` using HMAC-SHA-256 and a timing-safe comparison.
2. Reject an invalid signature with a generic `401`/`403`; do not change payment or order state.
3. Validate the event envelope and accepted payment topic/action.
4. Insert `PaymentEvent` using its unique deduplication key. A uniqueness conflict means the event was already accepted and can receive a successful acknowledgement.
5. Fetch the referenced order from `GET /v1/orders/{providerOrderId}` using the server-only access token. The webhook payload is a notification, not authoritative payment data.
6. Reconcile the fetched provider state in a short database transaction.
7. Return success promptly after durable processing or durable scheduling. Transient failures that are not durably scheduled should return a non-2xx response so Mercado Pago retries.

No browser should call this route. CORS is unnecessary.

### `GET /api/orders/[publicToken]`

Returns the sanitized order state used by the pending/success page.

Response fields:

- `orderNumber`
- `minecraftUsername`
- `rankSlug` and `rankName`
- formatted/display-safe total or `totalCents` plus `currency`
- `orderStatus`
- `paymentStatus`
- `fulfillmentStatus`
- `paidAt` and `fulfilledAt` when present

It must not return email, internal IDs, provider IDs, event payloads, failure internals, or credentials. Apply conservative rate limiting and `Cache-Control: no-store`.

This is a read-only route. Calling it, refreshing it, or opening `/checkout/success` must never mutate payment state. Optional provider reconciliation belongs in a protected background job, not in the page request.

### Internal fulfillment trigger

Prefer a platform scheduler/worker that directly runs server code and claims PostgreSQL rows. If deployment constraints require HTTP scheduling, expose `POST /api/internal/fulfillments/process` with a separate strong `Authorization: Bearer` secret, reject browser origins, rate limit it, and return only aggregate counts. It must never be linked from the UI.

An admin retry route is not part of the first MVP. Failed rows can initially be retried with an authenticated operational script. Add an admin surface only when authentication and authorization exist.

## Server-side pricing rules

`data/ranks.ts` is currently the shared rank catalog. Before enabling the backend:

- Add `priceCents` as an integer to each rank and derive `price` formatting from `priceCents`, or replace the display `price` field with a formatter. There must be one numeric price source, not a display price plus an unrelated backend price table.
- Keep the catalog importable by server code. Client rendering may receive the public rank object, but only the server uses `priceCents` to create an order and payment preference.
- Validate rank slugs against an allowlist. Unknown or disabled ranks return `404` or `400` and never create an order.
- Set `subtotalCents` from the selected catalog entry.
- Set `discountCents = 0` for the MVP. Never accept a client-computed coupon or discount.
- Compute `totalCents = subtotalCents - discountCents` on the server.
- Set `currency = BRL` on the server.
- Convert Mercado Pago's decimal amount to cents with a decimal-safe method and reject values with more than two decimal places. Do not multiply a JavaScript floating-point number without validation.
- Snapshot rank name, slug, and money fields on `Order` so later catalog changes do not affect existing purchases.
- Compare the verified provider amount and currency with `Order.totalCents` and `Order.currency` before approval. Any mismatch moves the payment/order to `REVIEW_REQUIRED`; it must not fulfill.

## Webhook processing flow

1. Mercado Pago sends an `order` notification when its order is created or updated.
2. Verify the Mercado Pago secret signature against the required request values. Do not trust source IP alone.
3. Parse only after applying a small request body limit.
4. Build a deduplication key and insert a `PaymentEvent`.
5. If the unique key already exists, acknowledge the duplicate without repeating side effects. If the existing event is retryable, let the normal retry worker handle it.
6. Fetch the order by provider resource ID from Mercado Pago's API using `MERCADOPAGO_ACCESS_TOKEN`.
7. Require the fetched order ID to equal the notification resource ID and the persisted `Payment.providerOrderId`.
8. Require `external_reference` to equal the related local `Order.orderNumber`, `currency_id` to equal the persisted currency, and `total_amount` to equal the persisted integer-cent amount exactly.
9. Map the provider status to `PaymentStatus`, but do not allow stale states to downgrade terminal success.
10. In one database transaction, update the existing payment, transition the order monotonically, and mark the event processed. Phase 4B does not create fulfillment.
11. Commit before acknowledging success.
12. The success page polls/loads the read-only order endpoint and renders `PENDING_PAYMENT`, `PAID`, `FULFILLED`, or failure/review state from the database.

If the buyer returns before the webhook arrives, show a pending confirmation state. The browser redirect may contain Mercado Pago status parameters, but they are display hints at most and must not be persisted as truth.

## Idempotency strategy

Idempotency is enforced with database uniqueness, transactions, and downstream idempotency keys rather than in-memory flags.

### Checkout creation

- The browser generates a random idempotency key once per submit attempt and reuses it for network retries.
- `Order.checkoutIdempotencyKey` is unique.
- Store a hash of normalized request fields with the key or compare the existing order snapshot. Same key plus same input returns the existing checkout result; same key plus different input returns `409`.
- Use the local order ID as the idempotency key for the Mercado Pago preference request when the selected API supports it.
- If the provider call succeeds but the response is lost, reconciliation uses the local order reference/provider idempotency key rather than creating a second charge attempt.

### Webhook events

- Prefer a Mercado Pago event/request identifier when documented as unique.
- Because not every notification shape guarantees a stable event ID, the fallback deduplication key is a hash of provider, topic/action, provider resource ID, and provider request ID/header when present.
- `PaymentEvent.deduplicationKey` has a unique database constraint. Do not rely on a check-then-insert race.
- `Payment.providerOrderId` and `Payment.providerPaymentId` are unique, preventing duplicate payment records and transaction linkage.
- Order/payment/event updates happen in one transaction.
- Re-fetching current payment state makes replay safe and handles out-of-order notifications.

### Fulfillment

- `Fulfillment.orderId` is unique, so an approved payment can enqueue fulfillment only once.
- The worker claims work atomically using a transaction and PostgreSQL row locking with `FOR UPDATE SKIP LOCKED`, or an equivalent atomic conditional update.
- Pass `Fulfillment.id` to the Minecraft integration as an idempotency key.
- The Minecraft bridge must record handled fulfillment IDs or implement a queryable assignment operation. If a response is lost, retrying the same ID must return the previous result rather than grant twice.
- Before granting, the bridge should check whether the target already has the same or higher rank and return a successful no-op when appropriate.

## Security boundaries

### Browser boundary

The browser is untrusted. It may choose only a rank slug and submit contact/fulfillment input. Client validation is usability only. The server repeats all validation and controls price, currency, status, references, redirect URLs, and fulfillment.

Public order status uses an unguessable bearer token because the MVP has no authentication. An order number alone is insufficient. Avoid exposing the token in analytics, logs, referrer headers, or third-party scripts. The later authentication phase should replace bearer-link access with account authorization where possible.

### Application server boundary

Only server runtime code may access:

- PostgreSQL credentials.
- Mercado Pago access token and webhook secret.
- Minecraft bridge URL and secret.
- Internal scheduler secret.

Environment variables without `NEXT_PUBLIC_` stay server-only. Modules that read secrets must be marked/server-scoped and never imported into client components. Logs must redact tokens, webhook signatures, full webhook bodies, email addresses, and provider credentials.

Validate all inputs with bounded lengths and allowlists. For the Minecraft username, finalize Java/Bedrock naming rules with the server team; do not silently apply a Java-only regular expression if Bedrock names differ. Normalize only what the Minecraft identity system guarantees is safe.

### Mercado Pago boundary

- Use HTTPS for checkout return and webhook URLs.
- Configure the webhook in Mercado Pago's application settings and enable secret-signature validation.
- Treat webhook payload fields as untrusted until signature validation and provider API re-fetch complete.
- Use separate test and production applications/credentials.
- Never expose `MERCADOPAGO_ACCESS_TOKEN` or `MERCADOPAGO_WEBHOOK_SECRET` to the browser.
- The public key is unnecessary for Checkout Pro redirect flow; add one only if a future client SDK explicitly requires it.

### Minecraft boundary

The web application must not connect to RCON directly over the public internet if avoidable. Preferred MVP boundary:

- A small private bridge/plugin runs in the Minecraft environment.
- It exposes a narrow operation such as `grantRank(fulfillmentId, username, rankSlug)` over a private network or tightly restricted HTTPS endpoint.
- Requests use TLS and a strong service credential, with IP/network allowlisting when available.
- The bridge maps rank slugs to predefined safe server actions. It must not accept arbitrary commands from the web application, preventing command injection.
- The bridge persists handled fulfillment IDs and returns deterministic results for duplicates.
- RCON credentials, LuckPerms credentials, console access, and command templates never reach the browser or general logs.

If a bridge cannot be deployed initially, use a server-side integration library with fixed command templates and strict allowlists, but keep RCON private and preserve the same idempotency contract.

## Failure and retry behavior

### Checkout creation failures

- Validation/catalog failure: return `400`/`404`; create no provider preference.
- Database unavailable: return `503`; the client may retry with the same idempotency key.
- Mercado Pago timeout or 5xx: keep the order in `PENDING_PAYMENT` with no usable preference, reconcile by idempotency/reference, and retry safely. Do not create a second order for the same key.
- Definitive provider 4xx: mark the payment attempt failed, return a generic checkout-unavailable response, and log a sanitized provider error code.

### Webhook failures

- Invalid signature or malformed event: reject without changing order/payment state.
- Duplicate event: acknowledge success after confirming the existing durable event.
- Mercado Pago API timeout/429/5xx: mark `PaymentEvent` as `RETRY_PENDING` with exponential backoff plus jitter. If retry storage fails, return non-2xx so Mercado Pago retries.
- Unknown external reference, amount mismatch, currency mismatch, or conflicting provider identity: mark `REVIEW_REQUIRED`, do not fulfill, alert operators, and acknowledge only after recording the issue.
- Database failure before commit: return non-2xx. No partial state should survive the transaction.

Suggested webhook retry schedule: 1 minute, 5 minutes, 15 minutes, 1 hour, 6 hours, then `DEAD_LETTER` after a bounded number of attempts. Mercado Pago redelivery remains an additional safety net.

### Fulfillment failures

- Network timeout, bridge unavailable, or Minecraft server offline: `RETRY_PENDING` with exponential backoff and jitter.
- Invalid username, unknown rank mapping, or explicit permanent bridge rejection: `FAILED` immediately and flag for support.
- Lost response after possible grant: retry using the same fulfillment ID. The bridge's idempotency record or rank check determines whether the prior attempt succeeded.
- Worker crash while `PROCESSING`: another worker may reclaim the row after the lease timeout (`lockedAt` is stale).
- After a bounded retry window, mark `FAILED`; keep the paid order paid and expose activation as delayed. Never roll back or refund automatically solely because Minecraft is unavailable.
- On success, update `Fulfillment.status = SUCCEEDED` and `Order.status = FULFILLED` in one transaction.

Suggested fulfillment retry schedule: immediate, 1 minute, 5 minutes, 15 minutes, 1 hour, then hourly up to a defined operational window. Alert after the first prolonged delay and on final failure.

### Refunds and chargebacks

Verified refund/chargeback notifications update payment and order state idempotently. Automatic rank revocation is out of MVP scope because removing a lifetime rank can have gameplay and support implications. Create an operator alert and handle revocation manually until a separate, audited revocation workflow is designed.

## Minecraft fulfillment flow

1. A verified Mercado Pago API response confirms the payment is approved.
2. Webhook processing validates external reference, exact cents, and BRL currency.
3. Phase 4B marks `Payment.APPROVED` and `Order.PAID` transactionally but does not insert a fulfillment. A later fulfillment phase will add that enqueue operation.
4. A worker atomically claims one due fulfillment and sets a lease.
5. The worker sends only `fulfillmentId`, validated `minecraftUsername`, and allowlisted `rankSlug` to the private Minecraft bridge.
6. The bridge checks whether `fulfillmentId` was already handled.
7. The bridge resolves `rankSlug` to a predefined LuckPerms/group action; it never executes caller-provided command text.
8. The bridge verifies the player identity/rank state and applies the rank or returns an idempotent already-applied result.
9. On confirmation, the worker records the bridge reference and marks the fulfillment successful and order fulfilled.
10. On a transient failure, the worker schedules a retry. On a permanent failure, it records a sanitized reason and alerts support.

For offline players, prefer a permissions system that can assign by a canonical UUID. If the current server can resolve only online players, retain the fulfillment as retryable and document that operational limitation before launch. Username-to-UUID resolution must come from a trusted Minecraft/server source and must handle Java and Bedrock identity differences explicitly.

## Environment variables

All variables below are server-only unless explicitly noted. Actual values belong in the deployment secret manager and local ignored environment files, never in source control.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled PostgreSQL connection used by the application. Require TLS in production. |
| `DIRECT_DATABASE_URL` | Deployment-dependent | Direct PostgreSQL connection for Prisma migrations when the pooler does not support them. |
| `APP_URL` | Yes | Canonical credential-free HTTPS origin used to construct Mercado Pago return URLs. |
| `MERCADOPAGO_ACCESS_TOKEN` | Yes | Server credential for Orders API creation and retrieval. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Yes | Secret used to verify webhook signatures. |
| `MINECRAFT_FULFILLMENT_URL` | Yes for automated fulfillment | Private bridge endpoint. |
| `MINECRAFT_FULFILLMENT_TOKEN` | Yes for automated fulfillment | Server-to-server bridge credential. |
| `INTERNAL_JOB_SECRET` | Only for HTTP-triggered worker | Authenticates an external scheduler to internal processing routes. |
| `ORDER_TOKEN_SECRET` | If tokens are derived/signed | High-entropy secret for signing or hashing public order-access tokens. Random stored tokens can be used instead. |
| `LOG_LEVEL` | No | Operational log verbosity; production must not log secrets or raw sensitive payloads. |

Do not create `NEXT_PUBLIC_MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_MERCADOPAGO_WEBHOOK_SECRET`, or any `NEXT_PUBLIC_MINECRAFT_*` variable. Checkout Pro does not require exposing the access token or Minecraft credentials.

## Implementation phases

### Phase 1: Catalog and database foundation

- Add a server-authoritative integer `priceCents` to the shared rank catalog and derive display formatting from it.
- Add Prisma and PostgreSQL configuration.
- Define the four models, enums, unique constraints, indexes, and database check constraints.
- Add migrations and seed no product rows; ranks remain code-defined for the MVP.
- Add server-only environment validation and a singleton Prisma client.
- Add tests for catalog price lookup, cents formatting/conversion, validation, and allowed state transitions.

Exit criterion: migrations run on a clean database and all price/order invariants are tested without contacting Mercado Pago.

### Phase 2: Order creation and Checkout Pro sandbox

- Implement `POST /api/orders` with server validation, request bounds, and idempotency.
- Implement `POST /api/orders/[orderNumber]/payment` with bearer-token access and create Mercado Pago Orders API orders with server-owned values, external reference, and return URLs.
- Persist provider order metadata and return only the redirect URL from the payment-start route.
- Connect the existing checkout form to this route and redirect to hosted Checkout Pro.
- Keep coupon behavior disabled.

Exit criterion: sandbox buyers can create exactly one order/preference per idempotency key, and tampered client prices have no effect.

### Phase 4B: Webhook verification and payment reconciliation

- Implement signature verification and the `PaymentEvent` inbox.
- Re-fetch order details from Mercado Pago and validate provider order ID, reference, amount, and currency.
- Implement transactional, monotonic payment and order state transitions without fulfillment enqueueing.
- Implement `GET /api/orders/[publicToken]` with sanitized output and rate limiting.
- Convert `/checkout/success` from a hardcoded preview into a read-only pending/success/failure status page driven by the order token.
- Add replay, duplicate, out-of-order, amount-mismatch, and invalid-signature tests.

Exit criterion: only verified webhooks can mark an order paid, duplicate webhooks have one durable event effect, no fulfillment is created, and opening a browser return page cannot mutate state.

### Phase 4: Minecraft fulfillment

- Implement or configure the private Minecraft bridge with fixed rank mappings and persistent idempotency records.
- Implement the PostgreSQL-backed fulfillment worker, leases, retries, and stale-lock recovery.
- Add test-mode bridge behavior and integration tests for success, duplicate delivery, timeout-after-grant, invalid player, and server downtime.
- Add support-visible logs/alerts for delayed and failed fulfillment.

Exit criterion: a verified sandbox payment grants one rank exactly once, including under duplicate webhook and worker retry scenarios.

### Phase 5: Production hardening and launch

- Separate sandbox and production credentials/databases or clearly isolated data.
- Configure production HTTPS webhook and signature secret in Mercado Pago.
- Verify secret storage, log redaction, CSP/security headers, request limits, rate limits, and database backups.
- Add monitoring for webhook error rate, dead-letter events, paid-but-unfulfilled orders, worker lease age, and provider API failures.
- Run reconciliation tests against Mercado Pago and an end-to-end low-value production purchase.
- Document manual refund, chargeback, failed fulfillment, and rank revocation procedures.

Exit criterion: operational alerts and recovery procedures are proven before enabling the purchase button for all users.

## MVP operational checks

Before launch, verify these properties explicitly:

- Changing price or status in browser devtools cannot affect an order.
- Prices are persisted and compared as integer cents.
- A success redirect without a webhook leaves the order pending.
- An invalidly signed webhook cannot update records.
- Replaying the same valid webhook many times creates one event effect and one fulfillment.
- Out-of-order pending notifications cannot downgrade an approved payment.
- An approved payment with the wrong amount, currency, or external reference never fulfills.
- A fulfillment timeout followed by retry does not grant the rank twice.
- No API response, client bundle, source map, or log exposes Mercado Pago, database, or Minecraft credentials.
- Paid orders remain recoverable when Mercado Pago, PostgreSQL, the worker, or Minecraft is temporarily unavailable.
