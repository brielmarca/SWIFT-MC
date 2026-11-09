# P5 regression and launch validation — 2026-11-09

## Decision

Local website regression checks pass. Payments remain disabled; nothing was
deployed. This is not approval for public commerce or proof of production
Cloudflare/Stripe/Paper connectivity.

## Results

| Command / suite | Result |
| --- | --- |
| `npm test` | 391 passed, 0 failed/skipped |
| `npm run test:db` | 88 passed per pass, twice; 0 failed/skipped |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed after both final builds |
| `npm run build` | Passed |
| `npm run build:vinext` | Passed, including postbuild type generation |
| `npm run typecheck` with `.next` moved aside | Passed |
| `npm run test:browser` | 142 passed, 20 fixture-only skips |
| `TEST_RUNTIME=vinext npm run test:browser` | 142 passed, 20 fixture-only skips |
| `node scripts/test-journeys.mjs` | 2 passed: desktop/mobile HTTPS account journey |
| `node scripts/test-header-browser.mjs` | 10 passed |
| `git diff --check` | Passed |

PostgreSQL 17.10 was restored using the exact Ubuntu packages described in
`postgresql-integration-tests.md`. All eight migrations applied to an isolated
Unix-socket-only cluster. Every application table was empty after both passes;
the cluster was stopped and removed. Provider/email traffic is mocked.

The database runner now includes `tests/payments` and `tests/fulfillment` as well
as `tests/integration`. Files run serially because the legacy fulfillment worker
scans the queue globally. Running those extra files outside the runner initially
skipped 14 database tests; those tests now execute against PostgreSQL.

## Failures investigated and fixes

- Initial unit baseline: 372/390 passed, 18 failed. Five tests expected the old
  webhook error format. Assertions now require the exact disabled-purchase
  response. Content/search tests depended on fictional articles/events removed
  by P5; synthetic data is now confined to test module mocks. SEO uses an explicit
  article fixture. Four rank hashes were updated only after inspecting the diff:
  the shared FAQ changed to Java-only and disabled-purchase copy; commercial
  rank fields did not change.
- Lint: removed the unused `User` icon import left by removing player search.
- Playwright initially could not collect because `/news` had a duplicate test
  title. After that fix, each runtime had 12 failures from old registration copy
  and retired/renamed navigation expectations. Those expectations now reflect P5;
  separate route/overflow checks cover the retired utility pages.
- Journey runner omitted `SWIFTMC_TEST_DB_MODE=local`, so its guarded database
  helper correctly refused access. The runner now provides its isolation marker.
  Its checkout step now checks disabled UI, direct API rejection, and no order
  creation instead of waiting for a removed payment form.
- Expanded database coverage initially exposed nine failures (including a cleanup
  hook). Fixed invalid test owner/currency fixtures, CUID expectations, missing
  mocked grant configuration, and fulfillment fixture cleanup/isolation.
- Confirmed application defect: new legacy `PENDING` fulfillments had null
  `nextAttemptAt` and were never selected by the queue worker. The query now
  includes unscheduled pending rows while preserving due-time filtering for
  scheduled retries. The existing database test reproduces and verifies the fix.
- Staging indexing depended solely on canonical configuration, whose fallback
  is production. Middleware now emits `X-Robots-Tag: noindex, nofollow` on
  non-production serving hosts. Browser checks verified it on both runtimes.

## TypeScript root cause and reproducibility

The reported errors were reproduced after building Vinext: Next's
`.next/types/validator.ts` imported `AppRoutes`, `LayoutRoutes`, `ParamMap`, and
`AppRouteHandlerRoutes`, but Vinext had overwritten `.next/types/routes.d.ts`
with its own incompatible declarations. Vinext's `dist/typegen.js` explicitly
writes that same path and `next-env.d.ts`. This is a generated-artifact collision,
not an application type defect.

`npm run typecheck` runs `next typegen && tsc --noEmit`. `postbuild:vinext` restores
Next's route declarations after Vite has finished. No application code or route
validator was excluded, and no TypeScript error was suppressed. Verified from a
missing `.next` directory, then through Next build, Vinext build, and plain tsc.
Direct `vite build` bypasses npm's postbuild hook; use the documented npm scripts
or run `npm run typecheck` afterward. Do not run the two build systems concurrently
against their shared generated files.

## Browser coverage and limits

Both production runtimes were exercised at 1440×900 and 390×844. Added launch
checks cover homepage, storefront, all four ranks, legal pages and retired
utility routes: HTTP 200, visible main content, no page JavaScript exceptions,
no document-width overflow, and preview noindex headers. Existing suites cover
auth forms, safe callbacks, verification UI, navigation, rank cards, disabled
purchases and security boundaries. Direct Stripe initiation returns 503 with
`PURCHASES_DISABLED`; alternative order/payment endpoints reject unauthenticated
attempts. Legal text explicitly identifies itself as preliminary/unapproved.

The real-database HTTPS journey verifies registration/resend/verification, cookie
sessions, logout, protected redirects, profile persistence, password recovery,
CSRF rejection and session revocation. It uses Next development HTTPS in a
disposable app copy with email capture and a test rate limiter. That harness
does not support a Vinext database-backed journey; do not describe the production
Vinext UI checks as equivalent end-to-end backend validation.

The 20 skips in each main browser run require separate auth-header or Phase A
runtime fixtures. The header fixture passed separately. Phase A crypto/binding
probes were not regenerated in this run. Development journeys emitted Next
image-aspect-ratio/smooth-scroll warnings; no pageerror was observed by the
journey's error assertion. This is not a blanket claim that all console warnings
or every possible route were eliminated.

Minecraft linking and Bridge authentication passed HTTP/domain/PostgreSQL tests.
There is no account linking browser form in the current account pages; real
in-game linking and delivery require a Paper server and remain staging work.

## Launch safety

- `PURCHASES_ENABLED` requires exactly `"true"`; absent/false disables Stripe
  before authentication, database work or provider calls. `.env.example` now
  explicitly documents `false`. No flag was enabled.
- Legacy order/payment routes remain unconditionally blocked after authentication;
  Mercado Pago cannot initiate payments through them. Stripe webhook signature
  verification remains active independently of new-purchase initiation.
- Bridge bearer-token minimum length, hash/timing-safe comparison, server ID
  matching and optional allowlist remain intact. Their tests pass.
- No application `.env`/`.env.local` was present. Targeted scans of nonignored
  source and browser build output found no Stripe secret values/private keys.
  Runtime secrets remain server-side bindings. This does not audit external
  dashboard settings or certify every opaque local archive/JAR.
- Host-based noindex protects preview URLs even with a production canonical URL.
  Validate the actual staging hostname/edge response before making it reachable;
  robots directives are indexing instructions, not access control.

## Git readiness and commit strategy

Nothing was staged, committed, discarded or deployed. The working tree already
contained a large multi-phase implementation, including deleted obsolete checkout
components, auth/account/Bridge sources, three untracked migrations, plugin source,
dependency/lockfile changes and P5 UI changes.

Preserve and review these migration files together with schema and consumers:

- `20261023000000_add_user_id_to_order`
- `20261105000000_add_login_lockout`
- `20261108203314_minecraft_bridge_vip_deliveries`

Suggested dependency-ordered commits (use explicit path staging, not `git add .`):

1. Auth/account persistence, migrations and their tests.
2. Bridge/VIP delivery schema, API/service implementation and tests.
3. Paper plugin source/resources/POM and build documentation.
4. P5 storefront/content/navigation/legal placeholders and disabled payment UI/API.
5. Validation harness, regression corrections, noindex protection, type-generation
   scripts, artifact ignores and this report. Include the legacy queue fix with
   its test coverage in a focused commit if it can be separated cleanly.

Review cross-cutting files (`package.json`, lockfile, schema, middleware, environment
example and shared tests) before assigning them to commits; intermediate commits
must include their imports and migrations. A final clean checkout must run all
checks before staging deployment.

Added explicit ignores preserve but exclude `bridge.zip`, Maven `target/`,
`minecraft/build-artifacts/`, local plugin `libs/*.jar`, and the two backup-file
locations. Existing ignores cover `.next`, `dist`, `.vinext`, `.cloudflare`,
environment secrets, Playwright output and tsbuildinfo. Plugin source remains
visible to Git. The plugin relies on local `libs/SwiftCash-0.2.0.jar` and a Paper
snapshot dependency: provision a trusted dependency source/checksum before
claiming a reproducible plugin build from a fresh checkout. Plugin build docs
also contain obsolete spaced paths and require reconciliation.

## Remaining public-launch blockers

1. Real staging validation of Cloudflare Hyperdrive/rate-limit/secret bindings,
   email delivery, TLS/cookies and protected routes on the deployed runtime.
2. Real Paper/LuckPerms/SwiftCash linking, delivery, retries, restart and duplicate
   ACK behavior; no live Minecraft server was exercised here.
3. Approved privacy/terms/refund policies and responsible-party/contact details.
4. Reconcile monthly-subscription marketing with the implemented one-time payment
   mode and checkout's explicit no-auto-renewal copy before enabling purchases.
5. Stripe test-mode staging checkout/webhook/refund/fulfillment acceptance and an
   explicit payment rollout decision. Public commerce remains blocked.
6. Commit the complete dependency-coherent implementation, provision the plugin's
   build dependency, and validate from a fresh checkout. Do not deploy this dirty
   worktree as an unreviewed artifact.
