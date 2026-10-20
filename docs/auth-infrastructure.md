# Auth Phase A — infrastructure readiness

Operator runbook and architecture reference. No resource in this document has been
provisioned or remotely verified by this pass. Commerce remains `DEMO_ONLY`.
No auth schema, login UI, sessions, or rate-limit enforcement is implemented.

## Boundaries prepared in the repository

- `lib/auth-infrastructure/prisma.ts`: `withAuthPrisma(env, callback)` constructs
  Prisma 6 + an internally owned pg adapter/pool inside each use scope, with one
  connection, a 3-second connection timeout and a 5-second query timeout. Cleanup
  awaits `$disconnect()` in `finally`, including callback/query failure. The
  adapter disposes its owned pool. Await all work inside the callback; never retain
  the client, return a lazy query, or use it in detached work.
- Only `env.AUTH_HYPERDRIVE.connectionString` is accepted. Missing binding fails
  closed. No `DATABASE_URL` fallback. Import `env` from `cloudflare:workers` inside
  server-only Worker code; pass the capability to the helper. No global clients,
  pools, or request-bound I/O. Commerce's `lib/prisma.ts` remains separate.
- `bindings.ts` describes optional future capabilities without claiming they
  exist. Object bindings are not environment strings. Never serialize `env`.
- Only the resource owner can establish that Hyperdrive caching is disabled;
  a connection string and a successful SELECT cannot prove it. Require reviewed
  resource configuration as well as connectivity evidence before using this path.
- User, session, permission, revocation and read-after-write queries must exclusively
  use the dedicated cache-disabled binding. Never reuse a cache-enabled catalog
  binding or Next/React cross-request data cache for these reads.

## 1. Provision a dedicated Hyperdrive per environment

1. Select the correct Cloudflare account. In **Storage & databases → Hyperdrive**,
   create a configuration named `swiftmc-auth-staging` connected to the **staging**
   PostgreSQL origin. Supply real host, port, database and runtime credentials in
   the dashboard, not shell history or this repository. Use verified TLS to the
   origin and a least-privilege runtime role (not the schema-owner migration role).
2. Disable **query caching** in that configuration. Save and inspect it again.
   The equivalent API resource property must be `caching.disabled: true`.
   If using Wrangler, the create/update flag is `--caching-disabled`; do not paste
   a credential-bearing connection string into a recorded terminal.
3. Record the actual resource ID, environment and redacted configuration evidence.
   Do not record passwords/connection strings. Set the non-secret build variable
   `AUTH_HYPERDRIVE_ID` to this real ID for the `auth-staging` build. The config
   emits `bindings.hyperdrive({ id })` as `AUTH_HYPERDRIVE` only in that mode.
4. In the deployed staging Worker's **Bindings**, verify `AUTH_HYPERDRIVE` points
   to that exact resource. Check the resource still reports caching disabled.
5. Repeat with a different production resource, role and database when production
   provisioning is authorized. Production binding is deliberately not declared
   yet: add `AUTH_HYPERDRIVE: bindings.hyperdrive({ id: realProductionId })` to the
   production branch of `cloudflare.config.ts` only after verifying that resource.
   Do not rely on a dashboard-only binding surviving source-driven redeployment.

There are no committed resource IDs. HTTP no-store, cache TTL zero, SQL tricks,
and successful SELECT 1 are not substitutes for Hyperdrive caching being disabled.

## 2. Direct-only migration/admin environment

Installed Prisma 6 supports `directUrl`; `prisma/schema.prisma` now sets it to
`DIRECT_DATABASE_URL`. No model or migration changed. Prisma migration commands
use that direct URL rather than the runtime datasource URL.

Use a trusted workstation or dedicated CI migration job with direct PostgreSQL
network access. Inject `DIRECT_DATABASE_URL` from its secret store, using a
separate schema-owner/admin role and verified TLS. This must be the actual database
origin, **not** a Hyperdrive local proxy, pooled endpoint, or Worker URL.
Neither `DIRECT_DATABASE_URL` nor production `DATABASE_URL` belongs in Worker
bindings, Build Output, public variables or browser code.

```sh
npm run db:migrate:status
# Only when an approved migration is actually being released:
npm run db:migrate:deploy
```

The wrapper requires a direct URL, maps both Prisma URL variables to it for the
CLI child only, and allows only status/deploy/dev. It rejects known Hyperdrive
local hosts; arbitrary proxy hostnames cannot be identified reliably in code, so
the operator must verify origin identity. It does not log URLs itself. Restrict
Prisma CLI logs to trusted operators. No migration command was executed in this pass.

Local development retains the existing `.env.example` URLs; both point to the
local PostgreSQL service. Copy/update both in your ignored `.env`, then use
`npm run db:migrate:dev`. Existing `npx prisma` workflows still work with both
variables set. `DATABASE_URL` remains for local/commerce tooling only.

## 3. Staging diagnostics — explicit, bounded, removable

Use a dedicated `swift-mc-auth-staging` Worker and HTTPS hostname, never the public
production Worker. Choose the same paid plan, compatibility date, application
bundle and CPU configuration intended for production. Do not deploy the local
`runtime-feasibility` fixture: its benchmark routes are intentionally unprotected.

1. Create the staging Worker in the dashboard if absent. Add an independent random
   32-byte base64url **runtime Secret** named `AUTH_DIAGNOSTICS_TOKEN` via
   **Settings → Variables and Secrets → Add → Secret**. Generate it in your secret
   manager. It is temporary, must be at least 43 characters, and must not be a
   build variable, URL parameter or committed `.dev.vars` value.
2. Protect the staging hostname with Cloudflare Access restricted to operators
   (or an operator service-token policy). Cover every route and disable/bypass no
   alternate public hostname; disable unused workers.dev and preview URLs. The
   probe additionally requires its own bearer token. Do not log request headers.
3. Prepare and build explicitly (these commands do not deploy):

   ```sh
   node scripts/auth-staging-fixture.mjs prepare
   npm run build:vinext -- --mode auth-staging
   npx cf deploy --prebuilt --dry-run --mode auth-staging --worker swift-mc-auth-staging
   ```

   Supply the real `AUTH_HYPERDRIVE_ID` through your build environment. Inspect
   the dry-run manifest: staging Worker name, correct binding ID, diagnostic secret
   name only, no direct URL or secrets serialized. Normal Worker builds reject
   generated staging routes; staging builds reject the unprotected local fixtures.
4. **Manual deployment, only after operator review:**

   ```sh
   npx cf deploy --prebuilt --mode auth-staging --worker swift-mc-auth-staging
   ```

   Verify the resulting remote bindings and Access coverage. No automatic deploy
   is part of this task. Do not reuse this prebuilt output for production.
5. From an authorized operator client, send a bodyless `POST` over HTTPS to
   `/auth-infrastructure-probe/database`, with `Authorization: Bearer <temporary
   token>` supplied by the secret manager. Include Access service-token headers
   if required. Do not put tokens in command history or URLs. Expect
   `200 {"connected":true}` and `Cache-Control: private, no-store`. Repeat in two
   sequential requests, then one pair of concurrent requests. This executes only
   `SELECT 1 AS ok`, no application tables or mutations. No binding/DB failure may
   disclose a URL or driver error; failures return generic 503.
6. A bodyless POST to `/auth-infrastructure-probe/scrypt` uses a fixed known
   noncredential test string, fresh 16-byte salts, N=32768/r=8/p=3, a 32-byte key
   and 64 MiB per-operation maxmem. It measures one hash, one verification and
   exactly two concurrent hashes. No query parameters/body/work factors are
   accepted. Missing/wrong secret, disabled flag or non-staging environment gives
   404 before work. GET has no handler. All results are private/no-store.
7. Run at most **three sequential invocations** of the scrypt probe manually.
   Do not load-test it, retry automatically, or run parallel HTTP benchmark calls.
   The pair inside each invocation is the sole intended concurrency measurement.
8. Record deployment version, plan/CPU setting, timestamp, Cloudflare Ray ID,
   sanitized result, platform CPU time and invocation outcome. Use Workers
   Observability invocation logs/metrics to detect exceeded CPU/memory limits.
   Platform termination may produce a Cloudflare error rather than our JSON and
   cannot be caught reliably inside the Worker. A timeout or missing result fails
   the run; inspect the platform outcome, do not call it a crypto success.

   In **Workers & Pages → swift-mc-auth-staging → Settings → Runtime**, inspect
   and explicitly set the CPU limit to the intended paid production budget (start
   with 30,000 ms if that is the approved deployment setting). Record the setting
   after deployment; repeat for production before its validation. In **Settings →
   Observability**, enable invocation logs for this short operator validation
   window, then inspect **Logs** and **Metrics** for CPU time and exceeded-resource
   outcomes at the recorded timestamps. Memory is a platform isolate limit, not
   a configurable scrypt allocation setting. Do not log headers, env or credentials.

Acceptance targets for this readiness gate: all three runs verify successfully;
each hash/verification ≤1000 ms; bounded pair ≤2000 ms; invocation CPU below 50%
of the explicitly configured deployment CPU budget; no CPU/memory termination.
These are conservative provisional thresholds, not latency percentiles from three
samples. Workers has a 128 MB isolate memory limit; two operations need roughly
64 MiB algorithmic storage plus the whole application. `process.memoryUsage()` in
workerd is not peak native memory evidence. Capture platform memory evidence if
available; otherwise record peak headroom as **unmeasured**, with absence of
termination only a bounded compatibility result. Production concurrency admission
still needs review. Never automatically lower parameters. Any failure requires
password policy/runtime review before Phase B.

After validation, delete the temporary runtime secret, disable/remove the staging
deployment or remove its diagnostic routes and redeploy the clean staging build.
Local cleanup alone does not remove an already deployed endpoint:

```sh
node scripts/auth-staging-fixture.mjs clean
npm run build
npm run build:vinext
```

Verify both probe URLs return 404 after remote cleanup. Production mode never
declares diagnostic enablement. The original local Phase A harness remains
available via `npm run test:auth-runtime` and still removes its generated outputs.

## 4. Future rate-limit topology and secrets

**Layer 1:** Workers Rate Limiting binding, cheap per-location burst control before
DB access/password hashing. Allocate a distinct numeric namespace per environment
and record it in the account's namespace inventory; never reuse an unrelated
limiter's namespace. Add in `cloudflare.config.ts` after approval:
`AUTH_RATE_LIMIT: bindings.rateLimit({ namespace: approvedNamespace,
simple: { limit: approvedBurstLimit, period: 60 } })`.
The period is 10 or 60 seconds. A starting proposal is 10 attempts per 60 seconds
per trusted client IP; policy owners must approve actual values before declaration.
This approximate, distributed layer is not an authoritative account lockout.

**Layer 2:** a separate coordinator Worker per environment, exporting
`AuthRateLimitCoordinator` with SQLite-backed Durable Object storage. The current
vinext fetch-handler does not export that class. When implementation is authorized:
create the coordinator Worker/class, declare its SQLite Durable Object export in
its own configuration (`exports.durableObject({ storage: "sqlite" })` with this
installed cf stack), deploy the initial namespace migration, and verify the real
export/namespace. Then add in the app config
`AUTH_RATE_LIMIT_COORDINATOR: bindings.durableObject({ worker: actualWorkerName,
exportName: "AuthRateLimitCoordinator" })` and verify cross-Worker access in the
same account. Do not create a namespace binding until that class actually exists.
No coordinator Worker or namespace is implemented/provisioned by this pass.

Route each sensitive identifier deterministically to one object. It atomically
checks and consumes counters with persisted expiry before admitting hashing;
pending concurrent attempts count immediately. State must survive eviction.
Fail closed on unavailable authority for sensitive operations. Define finite TTLs,
bounded storage, idempotency and retry semantics during implementation; never use
isolate memory or Layer 1 as the global authority. Apply both layers before scrypt.

Proposed key material (domain-separate operation/purpose and use unambiguous tuple
encoding before HMAC-SHA256; version the normalization and key scheme):

| Operation | Authoritative keys |
| --- | --- |
| Password login | HMAC(normalized email), HMAC(normalized email + trusted client IP) |
| Reset/registration | HMAC(normalized email) |
| Authenticated sensitive actions | Server-resolved user ID, never caller-supplied ID |

Never store/log raw emails as limiter keys. Centralize email normalization with
future account identity rules. Never trust arbitrary `X-Forwarded-For`.
`CF-Connecting-IP` is trusted only at the expected Cloudflare ingress, with no
untrusted direct path/subrequest able to supply it. Reject or conservatively deny
requests when that trust cannot be established.

In each actual app Worker, add independent 32-byte random runtime secrets through
**Settings → Variables and Secrets → Add → Secret**:

- `AUTH_RATE_LIMIT_KEY`: HMAC key; rotation must avoid silently resetting all
  authoritative limits (plan overlapping versioned counters).
- `AUTH_ENCRYPTION_KEY`: future encryption key; define versioning and old-key
  retention for the eventual data lifetime before consuming it.

Add matching `bindings.secret()` declarations only when the resources/secrets
are ready. Never use NEXT_PUBLIC_, config text bindings, Vite define or client
props. Staging and production have independent secrets and namespaces. No auth
key is required to render today's public storefront.

## 5. HTTPS cookies and edge cache verification (future session implementation)

No sessions are created here. The local Phase A dummy-cookie fixture verifies
serialization, not the deployed edge. After a protected HTTPS-only dummy fixture
is approved or real session routes exist, use two clean browser profiles A/B:

1. Inspect the actual `Set-Cookie` for `__Host-swiftmc_session`: `HttpOnly; Secure;
   SameSite=Lax; Path=/`, **no Domain**. Confirm DevTools reports no blocked-cookie
   warning and Application → Cookies contains the host-only cookie. Confirm
   `document.cookie` cannot read it.
2. Follow the login/dummy 303 redirect. Inspect the outgoing HTTPS request to the
   same host and verify it carries the cookie and resolves the expected identity.
3. Delete/logout: inspect empty value, `Max-Age=0`, expired `Expires` and the same
   path/security attributes. Confirm the browser removes it and a subsequent
   request is anonymous. Test real server-side revocation separately in Phase B.
4. In **zone → Caching → Cache Rules**, create explicit bypass rules for future
   auth APIs, account/session-dependent pages, and their RSC/prefetch requests.
   Ensure broad Cache Everything/Edge TTL rules cannot override these paths.
   Audit Worker Cache API usage too. Never key only by URL for authenticated data.
5. Inspect raw edge responses for HTML, API JSON, 303, errors and RSC/prefetch:
   require `Cache-Control: private, no-store`. Check repeated requests show no
   cache HIT or increasing Age (`DYNAMIC`/`BYPASS` or absent cache status alone is
   insufficient evidence). Preserve Set-Cookie through the edge.
6. In A/B, use distinct dummy personas or later independent test accounts. Replay
   the **same URL** in order A/B/A for full HTML, client navigation and prefetch.
   Capture actual browser RSC request headers/query and replay each variant with
   each profile's own cookie. Each response must contain only its own identity.
   Inspect Flight payloads, not only visible DOM. Recheck after revocation later.
7. Record redacted network evidence and deployed cache-rule configuration. Remove
   dummy fixtures/cookies after the check. Never export real session tokens in HARs.

## Remaining release gates

- Real dedicated cache-disabled Hyperdrive, PostgreSQL network/TLS/role validation
  and SELECT 1 through sequential/bounded concurrent Worker request scopes.
- Real paid Worker CPU/memory evidence at intended configuration and reviewed
  concurrency admission; local wall timings alone do not satisfy this gate.
- Verified direct-only migration environment/role and migration release ownership.
- Approved Layer 1 policy/namespace, implemented and provisioned coordinator,
  independent secrets and rotation policy.
- Live HTTPS cookie/redirect/deletion, CDN and authenticated RSC isolation checks;
  schema-dependent revocation tests await the later phase.

No Phase B work is authorized by passing these probes. All three commerce POST
endpoints must continue to return 503 `DEMO_ONLY` in every runtime.

## Local verification for this pass — 2026-10-20

- `npm test`: 138 passed, including scoped cleanup on success/failure, mocked
  SELECT 1, diagnostic rejection/sanitization, fixed scrypt output and direct-tooling
  rejection. No database connection was used by these tests.
- `npm run lint`, `npm run build`, `npm run build:vinext`: passed.
- `npm run test:browser` and `TEST_RUNTIME=vinext npm run test:browser`: 70 passed
  each; fixture-only tests are intentionally skipped in normal builds. Commerce
  503 `DEMO_ONLY`, security headers and existing behavior regressions passed.
- `npm run test:auth-runtime`: passed (7 Next and 9 workerd fixture checks), with
  public-asset secret isolation scans. Local workerd scrypt mean was ~272 ms and
  the bounded pair ~535 ms in this run; these are not production CPU measurements.
- Explicit `auth-staging` build and `cf deploy --prebuilt --dry-run` passed with
  no Hyperdrive ID supplied. Manifest named `swift-mc-auth-staging` and contained
  the diagnostic secret declaration, not its value. Nothing was uploaded.
- Prisma schema validation passed with inert localhost URLs supplied only to
  the validation process. Without `DIRECT_DATABASE_URL`, validation correctly
  fails; no real admin URL was supplied and no migrations ran.
- Generated local/staging routes were removed and normal artifacts rebuilt.
- `git diff --check`: passed.

These results do not establish that any Cloudflare account resource exists.
