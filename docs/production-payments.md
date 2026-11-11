# Production Stripe payments (Node)

## Configuration and isolation

Use `compose.production.yaml`, the `production` Docker target, and a new private
`deploy/production.env` based on `deploy/production.env.example`. The target reuses
the existing build, checkout, authentication and polling Bridge implementations.
Staging retains its own Compose project, startup validation, database and test keys.
Worker live checkout is deliberately not enabled by a generic purchase flag.

Production requires the explicit `APP_ENV=production`, `BACKEND_RUNTIME=node`,
`APP_URL=https://swiftmc.com.br`, a live Stripe key and the **live endpoint's** webhook
secret, plus `STRIPE_TEST_PURCHASES_ENABLED=false`. `PURCHASES_ENABLED=false` is the
initial default: switching it to `true` permits new checkouts. Webhooks remain active
when checkout is paused, so payments already in flight and refunds can reconcile.
Do not put secrets in `NEXT_PUBLIC_*`, image builds, command arguments or logs.

The runtime requires a dedicated `swiftmc_production` database and login of the same
name, loopback transport, and certificate hostname `db.swiftmc.com.br`. These are
explicit prerequisites, **not assertions about existing VPS provisioning**. The owner
must confirm role grants prohibit staging access and vice versa. Production runtime
rejects `DIRECT_DATABASE_URL`; schema-owner credentials belong in separate tooling.
The database must already have the repository's migrations applied by its owner;
this change contains no migrations and no automated production migration command.

Mount only the trusted database root CA at `/etc/swiftmc-production/db-ca.pem`
(root-owned 0444, parent 0755). If PostgreSQL uses Cloudflare Origin CA, install the
RSA or ECC Origin CA root matching the certificate issuer from Cloudflare's official
Origin CA documentation, not the leaf certificate or the Authenticated Origin Pull
CA. Confirm the server certificate SAN covers `db.swiftmc.com.br`. No private
PostgreSQL key belongs in the application container. TLS chain and hostname
verification are mandatory; URL SSL options are removed before explicit pg TLS
configuration is passed to the adapter.

Production Bridge uses `swift-production`, its own random bearer secret, and its
own player links/journal. Never point the staging plugin at production. Leave
`MINECRAFT_FULFILLMENT_URL` unset: delivery uses the polling Bridge only.

## Checkout and webhook contract

The checkout API retains session, Origin/CSRF and rate-limit validation, verified
email and linked Minecraft identity. VIP and Cash prices/bonuses come from the
server catalog and persisted order snapshots; a browser cannot choose the amount,
currency, recipient, or payment status. Stripe requests reuse a stable per-order
idempotency key. Return pages do not mark orders paid.

Register `https://swiftmc.com.br/api/webhooks/stripe` in Stripe **live mode** for:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`, `checkout.session.expired`
- `charge.refunded`

The existing production proxy must forward raw request bytes and `Stripe-Signature`
unchanged, inject the private `x-swift-backend-key` server-side, and direct requests
to `127.0.0.1:3101`. Do not reuse the staging gateway: it rejects the production
origin. Keep the backend port private; this task does not reconfigure the proxy.

Signatures are checked against the raw body within a five-minute window. Both the
signed event and API re-fetched resources must match the selected live/test mode.
Only completed, paid, one-time sessions with a payment intent can approve an order.
Session identity, metadata, cents and currency are reconciled to persisted data.
Event advisory locks plus order row locks serialize retries and distinct events;
payment, order, entitlement and Bridge queue writes commit together. Provider
outages return 503 and retain retry state for Stripe redelivery.

## Fulfillment and refunds

Database delivery enqueue is exactly-once per paid order. Bridge transport is
at-least-once: VIP delivery applies a final snapshot and Cash uses a stable
`cash_<orderId>` delivery ID, passed as the SwiftCash idempotency key. Persist and
back up the plugin journal and SwiftCash ledger. Verify the installed plugin's
crash-after-credit/before-ACK behavior before rollout; web tests cannot establish
exactly-once effects in a remote Minecraft server.

Full refunds revoke VIP entitlements and enqueue the final snapshot. Pending Cash
credits are cancelled. Already-applied Cash, a credit racing a refund, and partial
refunds require operator review: the current plugin cannot debit Cash. Partial
refunds are recorded as `REFUND_REQUIRES_REVIEW`, not treated as full refunds.
Do not promise automatic Cash clawback. Dispute/chargeback automation is not part
of the existing Stripe event contract; handle those through an operational process.

## Operator commands

Preparation only (does not deploy or charge):

```sh
# Run in the reviewed checkout. Do not overwrite an existing private env file.
test -e deploy/production.env || install -m 600 deploy/production.env.example deploy/production.env
${EDITOR:-vi} deploy/production.env
chmod 600 deploy/production.env
# Owner installs the verified CA and provisions the isolated DB/role separately.
docker compose -f compose.production.yaml config --quiet
PRODUCTION_IMAGE_TAG=REVIEWED_TAG docker compose -f compose.production.yaml build backend
```

Only **after deployment approval**, production proxy routing, database schema/TLS,
Stripe endpoint and Bridge prerequisites are verified:

```sh
PRODUCTION_IMAGE_TAG=REVIEWED_TAG docker compose -f compose.production.yaml up -d --no-build --wait backend
curl --fail http://127.0.0.1:3101/api/health/ready
```

Keep purchases false for initial readiness. After explicit payment rollout approval,
privately set `PURCHASES_ENABLED=true` and recreate the backend with the same command.
Pausing uses `false` and a backend recreation; preserve webhook/Bridge processing.
Rollback selects the prior production image tag without changing databases or
deleting volumes. Never use the staging deployment script for production.

## Local validation

`npm test`, `npm run lint`, `npm run typecheck`, `BUILD_VPS=true npm run build`.
`npm run test:db` with the PostgreSQL binaries described in
`postgresql-integration-tests.md` owns a fresh Unix-socket-only cluster, applies
migrations there, runs integration tests twice, verifies cleanup and deletes it.
Stripe fetches are mocked: no live API requests or charges are made. Integration
coverage includes mode separation, signature failures, amounts/currencies, VIP/Cash
delivery, refunds, provider retries and concurrent duplicate/distinct events.

Remaining rollout evidence: production CA/schema/role permissions, live endpoint
configuration, proxy routing, deployed plugin deduplication after restart, and the
manual Cash/partial-refund process. Docker execution and live-provider behavior
require separately approved infrastructure access.
