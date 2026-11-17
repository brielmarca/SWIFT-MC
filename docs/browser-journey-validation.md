# Browser journey validation

## Run the suites

The standard Playwright suite uses Chromium at desktop (1440×900) and mobile
(390×844) viewport sizes. Install its browser if needed with
`npx playwright install chromium`.

```sh
npm run build
npm run test:browser
node scripts/test-header-browser.mjs
npm run build:vinext
TEST_RUNTIME=vinext npm run test:browser
```

Allow at least ten minutes for the Workers preview browser suite. It is slower
than Next.js locally. Both standard suites start their own server on port 3100;
run them sequentially. The header fixture uses port 3102.

Vinext rewrites generated Next route types. Restore them before a subsequent
TypeScript check:

```sh
npm run build
npx tsc --noEmit
```

## Database-backed HTTPS journeys

Prerequisites: Node/npm dependencies, Chromium, OpenSSL, and PostgreSQL server
binaries. See [PostgreSQL setup](postgresql-integration-tests.md) for the rootless
installation used here.

```sh
PG_BIN=/tmp/opencode/postgresql/root/usr/lib/postgresql/17/bin \
PG_LIB=/tmp/opencode/postgresql/root/usr/lib/x86_64-linux-gnu \
node scripts/test-journeys.mjs
```

The runner creates a private temporary cluster, applies all real migrations,
and copies application sources into a disposable directory. It runs the actual
Next.js pages and route handlers over HTTPS on `127.0.0.1:3103`, using a temporary
self-signed certificate and Next development mode with webpack. Webpack is used
because the temporary copy links the existing dependencies outside its root.

Only the copy receives the test Workers-binding adapter. It provides a real
PostgreSQL connection and a local 10-requests/60-seconds-per-key rate limiter.
Application authentication, Origin checks, CSRF checks, password hashing,
transactions, and session validation remain active. The browser sends distinct
documentation-range client IP headers to model edge-provided addresses for the
two projects; this is not a test of Cloudflare's trusted-header enforcement.

Outbound Resend requests are captured to a private JSON-lines file, accepting
only `@journey.invalid` recipients. Other non-loopback server fetches are rejected
by the fixture transport. Browser external traffic is blocked and Minecraft
lookups/status are mocked. No production credentials or application `.env` files
are copied. The runner stops PostgreSQL and removes the copy, mail, keys, and
database in its cleanup path. Test identities cannot enter normal build output.

## Results and scope

| Validation | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Next.js production-build browser suite | 122 | 0 | 20 |
| Vinext production-build local Workers browser suite | 122 | 0 | 20 |
| Header/logout fixture | 10 | 0 | 0 |
| PostgreSQL-backed HTTPS journeys | 2 | 0 | 0 |

Each database-backed test is a complete multi-step journey, once per viewport.
The standard suite's 20 skips are 10 dedicated header-fixture cases (executed
separately above) and 10 Phase A diagnostic-fixture cases. Diagnostic routes are
intentionally absent from normal production builds.

The database-backed journeys verify:

- Protected-page redirects before login.
- Registration without premature account creation, captured verification links,
  genuinely expired database tokens, resend, and successful verification.
- Secure/HttpOnly session cookies and authenticated reload/navigation.
- Profile persistence, logout, and return to the original protected destination.
- Product selection and demo checkout completion without creating an order.
- Paid, delivered, and refunded labels rendered from seeded PostgreSQL orders.
- Password-reset delivery/form submission, session invalidation, and new-password
  login.
- Authenticated password changes through browser `fetch` to the real API,
  including rejection without CSRF and invalidation of the current session.
- No uncaught browser page errors during the completed journeys.

## Defects corrected

1. The profile form omitted `X-CSRF-Token`, causing authenticated saves to return
   403. It now reads the existing cookie, sends the header, and fails locally when
   the token is absent. Server protections are unchanged.
2. Login always navigated home despite a protected page's `callbackUrl`. The login
   page now validates that value with the existing server-side
   `internalReturnPath` validator and passes the safe destination to the form.
   Browser regression coverage rejects external, protocol-relative, encoded,
   and backslash-based redirect attempts.

## Launch gaps

- The current checkout UI is explicitly a demonstration. These browser tests do
  not verify initiating a real Stripe Checkout session from the store.
- There is no authenticated password-change form. Its real API was exercised
  from the browser, which is not equivalent to a user-facing form journey.
- Order presentation uses seeded order states, not a live payment-to-Minecraft
  fulfillment cycle.
- The HTTPS auth journey uses local substitutes for Workers bindings. Actual
  deployed Hyperdrive, Cloudflare rate limiting, email delivery, Stripe delivery,
  and Minecraft grants require separate environment validation. Local Workers
  preview reported missing provider secrets; its UI tests mock those responses.

After the application fixes, unit tests passed (385/385), PostgreSQL integration
tests passed twice (69/69 each, all application tables empty after each pass),
TypeScript and lint passed, and both production builds succeeded. These results
are automated local evidence, not production deployment certification.
