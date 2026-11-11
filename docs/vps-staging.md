# VPS staging backend

## Architecture and audit

The initial worktree was clean at `56c3801`. Existing authentication, sessions,
Resend, orders, Stripe reconciliation, and Paper Bridge implementations are reused.
The original compose file is a **local PostgreSQL 16 development service**, not
evidence of the VPS layout. The previous deployment report records an unconfigured
staging Worker. No SSH target/access was supplied or used; the VPS's current state
has not been independently verified.

New path: **browser → staging Cloudflare Worker → staging Cloudflare Tunnel →
Next.js Node server on 127.0.0.1:3100 → existing PostgreSQL 17 on loopback**.
The gateway serves the existing frontend and APIs from one origin, including SSR
and static assets; no CORS or cross-site cookies are needed. This staging topology
renders the frontend on Node. The existing Vinext Worker build remains supported.

Only `swiftmc_staging/public` is accepted by the Node deployment, including migration
tooling. Compose has no PostgreSQL service, published ports, or database volumes.
Use a dedicated staging DB role, with no production permissions. Migration and
runtime URLs may use separate staging roles. The owner must provision the staging
database/roles if absent; scripts neither create nor reset existing databases.

Runtime and migration connections use full PostgreSQL TLS verification (`sslmode=verify-full`,
`rejectUnauthorized: true`) with a trusted **Cloudflare Origin CA root** mounted read-only from
`deploy/certs` to `/run/secrets/db-certs` in both containers. Database URLs use the certificate
hostname `db-staging.swiftmc.com.br` with `hostaddr=127.0.0.1` so TCP stays loopback-only while
hostname verification matches the PostgreSQL certificate. Node/pg connections strip URL SSL params
and apply explicit `ca`/`servername` settings; Prisma 6 migrations run with `PGSSLMODE=verify-full`,
`PGSSLROOTCERT`, and `PGHOSTADDR=127.0.0.1`. `DATABASE_SSL_CA_PATH` and `DATABASE_SSL_SERVERNAME`
(`db-staging.swiftmc.com.br`) are required. A read-only TLS/connectivity preflight runs before
`prisma migrate deploy`. Certificate/key material is never committed.

## Immutable image pipeline (GitHub Actions → GHCR)

Staging images are built and published by GitHub Actions, **never on the VPS**:

- `.github/workflows/staging-image.yml` builds `linux/amd64` images from `Dockerfile.staging` targets `runtime` and `migrations` and pushes immutable tags to GHCR on `main` (and manual dispatch): `ghcr.io/<owner>/swiftmc-staging:staging-<sha>` and `...-migrate:staging-<sha>`.
- `.github/workflows/staging-validate.yml` validates compose rendering and Docker builds on PRs without publishing.
- Actions are SHA-pinned with least-privilege permissions; no application secrets are used in CI.

The VPS only pulls and runs prebuilt images for an explicit immutable `STAGING_IMAGE_TAG`.

## VPS deployment commands

Prerequisites: Linux, Docker Engine + Compose v2, PostgreSQL 17 reachable on loopback,
the existing staging DB and role, `cloudflared` at `/usr/bin/cloudflared`, a new
staging-only tunnel/hostname, and a checkout of these changes. Run from that checkout.
Do not use `compose.yaml`, production Worker commands, or a production tunnel.

**Swap:** preserve the existing **1 GB swap** on the VPS. `scripts/deploy-staging.sh`
preflight fails if swap is missing/too small (<900MB by default) to avoid unsafe deploys.

```sh
bash scripts/audit-staging-vps.sh
install -d -m 700 deploy/certs
# Install the trusted Cloudflare Origin CA *root* certificate (CA only, not leaf/private key), not committed:
install -m 444 /path/to/cloudflare-origin-ca-root.pem deploy/certs/origin-ca.pem
install -m 600 deploy/staging.env.example deploy/staging.env
${EDITOR:-vi} deploy/staging.env
openssl rand -hex 32
# Put the generated value in BACKEND_PROXY_SECRET privately; do not commit it.
# Fill staging-only DB role/password, keep DATABASE_SSL_SERVERNAME=db-staging.swiftmc.com.br and
# DB URLs with hostaddr=127.0.0.1, set APP_URL, Resend sender/key, Stripe TEST keys,
# webhook signing secret, and a separate random staging Bridge secret.

# Log in to GHCR if packages are private (use a read:packages token; never commit it):
# echo "$GHCR_TOKEN" | docker login ghcr.io -u <user> --password-stdin

# Deploy a prebuilt immutable tag (no VPS build). Requires STAGING_IMAGE_TAG.
STAGING_IMAGE_TAG=staging-<commit-sha> bash scripts/deploy-staging.sh
docker compose -f compose.staging.yaml ps
curl --fail http://127.0.0.1:3100/api/health/ready
```

`scripts/deploy-staging.sh` hardening behavior:
- **Locking:** exclusive `flock` prevents concurrent deploys.
- **Resource preflight:** checks available memory, free disk, and required swap (preserves existing 1 GB swap), Docker/Compose availability, and compose config before mutating state.
- **Pull-only:** `docker compose pull` + `--no-build --pull never` (no image builds on VPS).
- **Migrations:** runs immutable migrate image before backend restart; migration failure stops deploy without restarting backend.
- **Health verification:** waits for container health and verifies `GET /api/health/ready`.
- **Safe rollback:** on start/health failure, automatically rolls backend back to the previously recorded immutable tag/image and re-verifies health (no schema rollback). Release state is recorded in `deploy/.staging-state/`.
- **Persistent diagnostics:** pre/post/failure snapshots (host resources, compose ps, health, recent logs, docker stats) written to `deploy/diagnostics/`.

Useful modes: `STAGING_IMAGE_TAG=staging-<sha> bash scripts/deploy-staging.sh --preflight-only`.

The audit uses `PGSERVICE=swiftmc_staging` when psql is available; configure that
service privately first. Inspect its output before deployment: PostgreSQL must
not listen on `0.0.0.0` or `::`. If it already does, stop and have its owner correct
that existing infrastructure separately. No firewall or PostgreSQL config is changed.

Provision a **new** tunnel under the account controlling the staging hostname:

```sh
cloudflared tunnel login
cloudflared tunnel create swiftmc-vps-staging
cloudflared tunnel route dns swiftmc-vps-staging staging-origin.YOUR-DOMAIN
sudo install -d -m 755 /etc/swiftmc-staging
sudo install -m 600 "$HOME/.cloudflared/TUNNEL_UUID.json" /etc/swiftmc-staging/tunnel.json
sudo install -m 644 deploy/cloudflared.staging.yml.example /etc/swiftmc-staging/config.yml
sudo ${EDITOR:-vi} /etc/swiftmc-staging/config.yml
sudo install -m 644 deploy/swiftmc-staging-tunnel.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now swiftmc-staging-tunnel.service
```

Replace `TUNNEL_UUID` and `staging-origin.YOUR-DOMAIN` with the newly provisioned
staging values. Adjust the cloudflared binary path if necessary. No public inbound
application or database port is required. Use a private staging-only tunnel
credential. No tunnel, DNS record, service, or Worker was provisioned during this task.

From a trusted workstation with Cloudflare access:

```sh
${EDITOR:-vi} deploy/wrangler.staging.jsonc
# Set APP_URL to the actual new worker hostname; BACKEND_ORIGIN to the tunnel hostname.
npx wrangler@4.160.0 deploy --config deploy/wrangler.staging.jsonc
npx wrangler@4.160.0 secret put BACKEND_PROXY_SECRET --config deploy/wrangler.staging.jsonc
# Paste the same private value as the VPS. The gateway fails closed until supplied.
curl --fail https://swift-mc-vps-staging.YOUR-SUBDOMAIN.workers.dev/api/health/ready
```

The gateway uses a distinct Worker name, no zone routes, and no database/payment
secrets. Its origin key is runtime-only. `APP_URL` on the VPS must exactly equal
the gateway origin. Existing frontend fetches remain same-origin.

## Payments and Minecraft

Keep `PURCHASES_ENABLED=false` permanently for this deployment. After adding test
credentials and configuring the staging Paper plugin, set only
`STRIPE_TEST_PURCHASES_ENABLED=true`, then rerun the deployment command. Checkout
accepts `sk_test_`/`rk_test_`; signed webhook events must explicitly have
`livemode=false`. Live keys cause startup/configuration failure.

Stripe **test** webhook endpoint: `APP_URL/api/webhooks/stripe`. Subscribe to
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
Use the test endpoint's signing secret. Test checkout does not mark an order paid;
only signed, provider-reconciled events do so.

Paper Bridge base URL: `APP_URL`, server ID **swift-staging**, separate Bearer secret.
Link through the account UI and staging plugin. VIPs use existing snapshot semantics;
Cash uses persisted amount+bonus and stable `cash_<orderId>` delivery IDs. The plugin's
SwiftCash idempotency key prevents duplicate credit. Refunds cancel pending Cash
deliveries; already-credited Cash requires manual reconciliation because the existing
plugin supports CREDIT only. A credit fetched just before refund can still be applied;
record and reconcile this race on the staging server. No automatic debit is implemented.
Legacy fulfillment push is rejected in this deployment to avoid duplicate delivery.

## Endpoints

| Method | Path | Contract |
|---|---|---|
| GET | `/api/health/live`, `/api/health/ready` | Liveness; DB/schema readiness (503 on failure) |
| POST | `/api/register`, `/api/verify-email`, `/api/auth/resend-verification` | Existing registration/verification flows |
| POST | `/api/login`, `/api/logout` | Secure opaque sessions; Origin and CSRF validation |
| GET | `/api/session` | Session status |
| POST | `/api/password-reset/request`, `/api/password-reset/complete` | Email reset flow |
| GET/POST | `/api/user/profile` | Own profile |
| POST | `/api/user/password` | Atomic password change and session revocation |
| GET | `/api/user/orders`, `/api/user/orders/:orderNumber` | Owner-scoped history |
| POST | `/api/checkout/stripe` | `{type:"vip"|"cash",rankSlug,idempotencyKey:UUID}` |
| POST | `/api/webhooks/stripe` | Raw-body HMAC, test events, idempotent reconciliation |
| POST | `/api/user/minecraft/link-code` | One-use link code |
| GET | `/api/user/minecraft/status` | Own linked identity |
| GET | `/v1/bridge/pending`, `/v1/bridge/status` | Authenticated plugin reads |
| POST | `/v1/bridge/link`, `/v1/bridge/ack` | Authenticated plugin linking/ACK |
| GET | `/api/server-status` | Minecraft status (not `/api/server/status`) |

Bridge routes also exist under `/api/v1/bridge/*`. Browser mutations require
`Origin: APP_URL`, secure session cookies where applicable, and matching
`X-CSRF-Token`. Cash slugs: `cash-50`, `cash-100`, `cash-300`, `cash-500`, `cash-1000`.
Prices and bonuses come from the server catalog. `/store` links Cash to
`/checkout?cash=100`; VIPs use the existing cart. Legacy demo order routes stay blocked.

## Lightweight monitoring and diagnostics

- `scripts/monitor-staging.sh` captures periodic health/resource snapshots (health endpoint, backend running state, memory/swap/disk/load) to persistent logs under `deploy/diagnostics/monitor.log` with size-based rotation. It is read-only and exits non-zero when unhealthy (suitable for alerting schedulers).
- Optional systemd units: `deploy/swiftmc-staging-monitor.service` and `deploy/swiftmc-staging-monitor.timer` (5-minute cadence). Install/adjust `WorkingDirectory` and paths for the VPS checkout, then `systemctl enable --now swiftmc-staging-monitor.timer`.
- Deploy-time diagnostics are captured by `scripts/deploy-staging.sh` in `deploy/diagnostics/deploy-<timestamp>.log`.

## Verification and rollback

```sh
npm test
npm run lint
BUILD_VPS=true npm run build
node scripts/test-staging-api.mjs
npm run build:vinext
npm run typecheck
# With PG_BIN/PG_LIB configured as in postgresql-integration-tests.md:
npm run test:db
```

DB tests own a fresh Unix-socket-only cluster and use `swiftmc_staging`, never the
VPS database. Providers/email are mocked. Do not run the two builds concurrently.
API smoke checks intentionally use an unreachable database and verify fail-closed
responses; they do not prove external provider connectivity.

**Automated rollback (deploy script):** if `up --wait` or health verification fails,
`scripts/deploy-staging.sh` attempts to roll back the backend container to the previous
immutable tag recorded in `deploy/.staging-state/` and re-checks health. Migrations are
not reverted.

**Manual rollback** to a retained immutable staging image without reverting schemas:

```sh
STAGING_IMAGE_TAG=PREVIOUS_STAGING_TAG bash scripts/deploy-staging.sh
# or, if you must bypass preflight/deploy flow (not recommended), direct compose with the prior tag:
# STAGING_IMAGE_TAG=PREVIOUS_STAGING_TAG docker compose -f compose.staging.yaml up -d --no-build --pull never --no-deps --wait backend
```

Both migrations are additive; retain the rate table and Cash snapshot column on
rollback. Never run `down -v`, `migrate reset`, or delete database files. Snapshot
the staging database with existing backup tooling before applying migrations. No
production containers, DNS, tunnels, or secrets are modified by this workflow. Keep
payments disabled (`PURCHASES_ENABLED=false`).

## Validation record — 2026-11-10

- Unit/security tests: **399 passed**, no failures/skips.
- PostgreSQL 17.10: **91 passed twice**, no failures/skips; ten migrations applied,
  application tables empty after both passes; disposable cluster removed.
- `BUILD_VPS=true npm run build`, `npm run build:vinext`, lint, typecheck: passed.
- Local HTTP API smoke: ten assertions passed (plus liveness startup check),
  including origin protection, failed-DB rate limiting, secure CSRF cookies,
  signed-webhook rejection, Bridge rejection, and account redirect.
- Wrangler **4.160.0** gateway deploy **dry run**: passed. No Worker uploaded.
- Docker build/Compose runtime: **not run**, Docker is unavailable locally.
- VPS audit, tunnel/systemd startup, real Stripe test checkout/webhook delivery,
  Resend delivery, and Paper/LuckPerms/SwiftCash end-to-end: **not verified**.
  These require staging access, credentials, and a running staging Minecraft server.
- Cash refund debit/reconciliation remains manual after delivery; see above.

Key modified areas: `lib/auth-api/`, `lib/auth-infrastructure/`, `lib/prisma.ts`,
`lib/staging-config.ts`, `lib/server-env.ts`, `lib/purchase-gate.ts`, `lib/orders/`,
`lib/payments/`, `lib/minecraft-bridge/service.ts`, checkout/store pages and
components, `middleware.ts`, `next.config.ts`, `prisma/schema.prisma` and the two
`20261110*` migrations. Added deploy artifacts are `Dockerfile.staging`,
`.dockerignore`, `compose.staging.yaml`, `deploy/*`, and the staging audit/deploy/API
scripts. Regression coverage is in `tests/staging-backend.test.ts` and the database
integration tests. The DB runner/helper now select the disposable staging DB name.
