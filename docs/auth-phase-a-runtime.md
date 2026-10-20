# SwiftMC authentication — Phase A runtime feasibility

Local evidence collected 2026-10-20. This is a feasibility reference for the maintainers deciding whether to begin Phase B, not an authentication implementation or production certification.

Infrastructure follow-up: [auth infrastructure runbook](auth-infrastructure.md) supersedes the migration/factory recommendations below: Prisma now has `directUrl`, a reusable scoped helper, and a separate protected staging probe. The historical local measurements remain unchanged; live resources are still unverified.

Installed runtime: Next.js **16.3.8**, React **19.3.0**, vinext **1.0.1**, Prisma client/adapter **6.19.3**, pg **8.23.1**, Node **24.21.0**. Workers builds use the existing `2026-10-07` compatibility date and `nodejs_compat`. `vite preview` launched the installed **workerd** executable; these are not Vite-on-Node emulations.

## 1. scrypt benchmark results

`lib/auth-feasibility/crypto.ts` uses `node:crypto.scrypt` with **N=32768, r=8, p=3**, a random **16-byte salt**, and a **32-byte derived key**. `maxmem=64 MiB` is an allocation ceiling, not a reduction in password cost. The default Node 32 MiB ceiling is too close to the approximately 32 MiB core allocation plus overhead for this baseline.

Each invocation performs exactly three sequential hashes and one pair of concurrent hashes. Inputs are random, temporary, non-user data. No passwords, keys, salts, or derived hashes are logged or persisted.

| Production bundle/runtime | Sequential durations (ms) | Mean (ms/hash) | Two concurrent hashes, total wall time (ms) |
| --- | --- | --- | --- |
| Next / Node | 322.35, 332.37, 340.04 | **331.59** | **333.36** |
| vinext / local workerd, completed full test run | 303, 276, 250 | **276.33** | **605** |
| vinext / initial run, while Node was building | 357, 360, 324 | **347** | **731** |

Parameters were accepted in both runtimes. Repeated derivations matched using `timingSafeEqual`; independently salted derivations differed. No native addon was installed or required. Workers did not show Node's parallel speedup; do not assume the async callback means non-blocking parallel execution in workerd.

Node RSS before/after was 133,390,336 / 133,791,744 bytes (about +0.38 MiB); heap used was 35,178,208 / 35,221,384 bytes. These snapshots **do not capture peak native allocations**. Workers `process.memoryUsage()` returned all zeroes, so it is not an observable memory measurement. Algorithmic working storage is approximately `128*N*r = 32 MiB` per hash, before overhead; two genuinely parallel hashes would need about 64 MiB plus the application. `maxmem` is not an isolate memory cap.

**Decision: compatible locally, conditionally feasible for paid Workers; not approved for production limits yet.** These are wall timings, not billed CPU measurements. Workers Free's 10 ms CPU budget is unsuitable for this CPU-heavy baseline. Paid Workers' default 30 s CPU budget gives plausible headroom, but the 128 MB per-isolate limit, application overhead, production CPU accounting, and admission control still need validation. No parameters were weakened. If deployment measurements fail, prefer preserving this baseline in an approved dedicated password-verification service/runtime, or separately approve and benchmark another password KDF. Do not substitute SHA-256 password hashing.

## 2. Crypto primitives supported

Both production bundles passed: `randomBytes`, SHA-256 known-answer test, HMAC-SHA256 known-answer test, equal/unequal `timingSafeEqual`, async `scrypt`, and AES-256-GCM encrypt/decrypt with AAD. A changed GCM tag was rejected. AES keys and 12-byte IVs exist only in memory for the invocation.

Future session tokens must be high-entropy opaque random values; SHA-256 is appropriate only for their database lookup digests, not passwords. A real verifier must validate stored encoding/parameters and lengths before the fixed-length constant-time comparison. The probe demonstrates API support, not a statistical constant-time proof. Future PKCE encryption also needs nonce uniqueness, purpose-bound AAD, expiry, and key rotation.

## 3. Cookie behavior results

On Node and workerd, the isolated Route Handler preserved two distinct `Set-Cookie` headers and the production attributes on `__Host-swiftmc_session`: **HttpOnly, Secure, SameSite=Lax, Path=/, no Domain**. A 303 redirect carried both cookies before its response body. Deletion explicitly set an empty value, `Max-Age=0`, epoch `Expires`, and the same security/path attributes. The secondary cookie survived header serialization.

The Chromium context cookie jar accepted the loopback Secure cookie and removed it after deletion. These tests use only dummy values and loopback's trustworthy-origin exception; an actual HTTPS domain/edge has not been exercised. Cookie mutations belong in Route Handlers before streaming, not in an already-streaming Server Component.

## 4. Cache isolation results

Route Handler JSON and 303 responses preserved exact `Cache-Control: private, no-store`. The dynamic SSR fixture (`force-dynamic`, `revalidate=0`, request `headers()`) returned private/no-store headers in both runtimes. Sequential first/second/first dummy-persona requests produced the corresponding distinct HTML; the other persona was absent.

For Phase B, keep authentication/session/permission reads out of `unstable_cache`, `use cache`, ISR, module-level result caches, and Cloudflare Cache API. Request-local deduplication is acceptable only within one request. Auth APIs, redirects, HTML **and RSC/prefetch variants** must be private/no-store. The current probe covers HTML and embedded Flight output, not every future RSC navigation path. No live zone Cache Rules were available: explicitly bypass caching for future auth routes and confirm the edge does not override these headers before release. Local headers alone cannot certify a remote CDN configuration.

## 5. Recommended Prisma/Hyperdrive lifecycle

`lib/prisma.ts` lazily initializes a **module-level** Prisma singleton and additionally caches it on `globalThis` outside production. Lazy creation prevents import-time configuration failures but **does not make the pool request-scoped**. Its underlying pg connections may retain request-bound Workers I/O and be reused by a later request. Do not reuse this singleton for Workers authentication.

Recommended Workers lifecycle:

1. Inside the request, obtain `env.AUTH_HYPERDRIVE` from **`cloudflare:workers`**.
2. Fail closed when missing; do not fall back to a production `DATABASE_URL`.
3. Create a fresh `PrismaPg({ connectionString: env.AUTH_HYPERDRIVE.connectionString, max: 1, connectionTimeoutMillis: 3000 })` and `PrismaClient({ adapter })`. Reuse only within that request. Hyperdrive owns the durable origin pool.
4. Finish/await all request queries and transactions, then `await prisma.$disconnect()` in `finally`. The installed adapter's internally owned pool is ended by disposal (`@prisma/adapter-pg/dist/index.js`). If later using an external Pool, explicitly own its cleanup or set `disposeExternalPool`.

`lib/auth-feasibility/prisma.ts` prototypes this factory and a read-only `SELECT 1` probe. The constructor regression proves two clients are independent and construction works with `DATABASE_URL` removed, using a non-connecting localhost fixture. Prisma's `engineType = "client"` is already present, avoiding the Rust query-engine addon. The Prisma/pg probe also bundles and imports in workerd. **No real Hyperdrive/PostgreSQL query was possible because AUTH_HYPERDRIVE is not configured.** This is not an end-to-end database pass.

Existing production DB behavior is untouched. Existing `getPrisma()` still requires `DATABASE_URL`; only the isolated factory is independent of it.

Migration tooling is separate: current Prisma 6 schema reads `DATABASE_URL` and has **no `directUrl` yet**. In a trusted local/CI migration process, map the explicitly supplied `DIRECT_DATABASE_URL` to that CLI process's `DATABASE_URL`, without exposing either to Workers, and run Prisma tooling there. Alternatively add an approved tooling-only configuration/direct URL in Phase B. Never migrate through Hyperdrive, and never reuse runtime DB credentials for schema administration. No migrations or commerce table changes were made.

## 6. How auth query caching will be disabled

**AUTH_HYPERDRIVE must reference a dedicated cache-disabled Hyperdrive configuration.** Disable caching on the resource itself (`caching.disabled: true` in the Cloudflare API; Wrangler's `hyperdrive create/update ... --caching-disabled` equivalent). Provision with the real resource ID later; none is invented here.

Before enabling auth, inspect the resource configuration and require `caching.disabled === true`. Bind that exact resource as AUTH_HYPERDRIVE. Use only its request-scoped Prisma client for users, session expiry/revocation, permissions, and read-after-write checks. Keep any cache-enabled catalog binding/client separate. Cache max-age=0, SQL comments, `NOW()` tricks, and HTTP no-store are **not** substitutes for disabling Hyperdrive query caching. Hyperdrive does not invalidate cached SELECTs on writes.

Acceptance test after provisioning: read a disposable session through one request, revoke it through another connection, then read it in a new request and require immediate denial. This cannot run until the later schema/implementation exists; no session table was created in Phase A.

## 7. Cloudflare binding compatibility

The actual configuration source is `cloudflare.config.ts` using `cf/config`, not Wrangler. The installed `@cloudflare/config` declarations support:

| Future binding | Supported declaration | Required later |
| --- | --- | --- |
| AUTH_HYPERDRIVE | `bindings.hyperdrive({ id })` | Real cache-disabled resource ID; optional local `dev.connectionString` |
| AUTH_RATE_LIMIT | `bindings.rateLimit({ namespace, simple: { limit, period } })` | Chosen namespace and approved limit; period 10 or 60 seconds |
| AUTH_RATE_LIMIT_COORDINATOR | `bindings.durableObject({ worker, exportName })` | Real exporting Worker/class and namespace lifecycle |
| AUTH_RATE_LIMIT_KEY | `bindings.secret()` | Runtime secret provisioning |
| AUTH_ENCRYPTION_KEY | `bindings.secret()` | Runtime secret provisioning and rotation policy |

The existing `vinext/server/fetch-handler` entrypoint does not export a coordinator class. Phase B needs a separate coordinator Worker, or an approved wrapper entrypoint plus an `exports.durableObject({ storage: "sqlite" })` declaration. A binding declaration alone does not implement the class. The built-in rate limiter is not a globally strong account-attempt authority; coordinator semantics still need implementation.

The workerd fixture successfully imported `env` from `cloudflare:workers` and accessed the existing non-string `ASSETS.fetch`. It inspects only capability/presence flags for the future bindings, never serializes the environment. Production configuration received no fake IDs, namespaces, secret values, or newly required secrets. Non-string bindings must not be read from `process.env`; text/secret population does not turn objects into usable runtime capabilities.

## 8. CSRF/origin prototype result

`lib/auth-feasibility/security.ts` is server-only. Exact Origin validation passed unit and real Route Handler tests on both runtimes. It rejects missing, malformed, `null`, wrong-scheme, wrong-host, wrong-port origins, credentials, path suffixes, and lists. Only the configured serialized origin is accepted. The fixture's trusted origin is fixed in server code; it never trusts Host or forwarded headers. Production configuration must require HTTPS. `Sec-Fetch-Site` was readable in both runtimes; its presence alone is not CSRF protection.

Later add an anonymous **AuthBrowserContext**: a random opaque, HttpOnly, Secure browser-context cookie identifies a short-lived server-authoritative record containing a high-entropy synchronizer-token digest and expiry. Deliver the token only in a private/no-store same-origin form/response; require it on protected mutations alongside exact Origin and Fetch Metadata policy. Compare fixed-length digests in constant time, rotate/invalidate on relevant auth transitions, and bind OAuth state/PKCE to that context with one-time expiry. Do not put tokens in URLs. The OAuth callback has a separate state+PKCE validation flow; do not blindly require a browser mutation Origin header on its cross-site GET redirect. No CSRF token storage or Server Action reliance was implemented.

## 9. Redirect-validator result

Safe `/account`, query, and fragment paths pass. External schemes, protocol-relative paths, single/double-encoded slash variants, backslashes, control characters, malformed percent encoding, and normalized double-slash paths are rejected. The conservative prototype rejects encoded slashes/backslashes anywhere. It returns a normalized local path or null; future callers must use a fixed safe fallback on null and must not decode the returned value again. No OAuth flow exists yet.

## 10. Secret-isolation result

All prototype modules and the Workers binding fixture use `server-only`. The production client component tree contains no references to AUTH_RATE_LIMIT_KEY, AUTH_ENCRYPTION_KEY, or DISCORD_CLIENT_SECRET. Neither config emits secret values nor declares a `NEXT_PUBLIC_` alias for these names.

`scripts/check-auth-public-assets.mjs` scanned **36 Next static files and 82 Cloudflare public asset files** in the fixture builds, finding none of the three private names or crypto-probe implementation markers. SSR/embedded Flight and binding responses were checked for the private names. Worker **bundle** files are server code even if internal chunk paths include `_next/static`; public files are under the sibling **assets** directory.

This is current-build isolation evidence using placeholder names only. It does not claim a framework can prevent a future developer from explicitly passing secret values into Client Component props. Future secret access must remain in server-only modules with explicitly allowlisted return values, no env-object spreading, no Next `env`/Vite `define` secret injection, and no secret props or logging. Re-run artifact/serialization checks when real consumers are added. No permanent keys or secret values were created, printed, or embedded.

## 11. Commerce regression result

Existing unit tests with forged input/configured credentials and real HTTP tests in both production runtimes passed for:

- `POST /api/orders`
- `POST /api/orders/[orderNumber]/payment`
- `POST /api/webhooks/mercadopago`

All return **503**, `error: "DEMO_ONLY"`, and no-store. Commerce remains unconditional; no handler or commerce schema was modified.

## 12. Blockers before Phase B

1. Confirm paid Worker CPU budget and production-isolate memory headroom with a bounded measurement. Local workerd success does not establish those quotas. Preserve baseline parameters pending approval.
2. Supply a real cache-disabled AUTH_HYPERDRIVE and a test PostgreSQL database; exercise the read-only Prisma probe, request cleanup, sequential requests, and bounded concurrency without DATABASE_URL. Actual origin reachability and query caching remain unverified.
3. Select/provision rate-limit namespace and coordinator topology, plus secret/key lifecycle, before password endpoints are enabled.
4. Establish direct-only migration tooling and database permissions separately from the runtime.
5. Verify HTTPS cookie behavior and private/no-store across the real edge and future RSC navigation/prefetch paths. Add actual revocation and browser-context tests with Phase B.

### Reproduce the isolated probes

```sh
npm run test:auth-runtime
```

This builds temporary ignored routes from `tests/fixtures/auth-runtime`, tests Next and workerd sequentially, scans public artifacts, then removes the routes and both probe-bearing outputs in `finally`. It never deploys. Recreate normal artifacts afterward with `npm run build` and `npm run build:vinext`. Do not deploy while manually prepared fixture routes exist. If interrupted externally, run `node scripts/auth-runtime-fixture.mjs clean` and rebuild both runtimes before any release.

The optional Workers-only `/runtime-feasibility/bindings?database=1` runs `SELECT 1` only when a real AUTH_HYPERDRIVE is supplied; missing configuration gives a sanitized 503. It does not read existing tables. Normal-build browser regression coverage requires all three probe paths to return 404.

Full browser suites passed against the fixture-bearing production bundles (Next: 75 passed with duplicate benchmark skipped; Workers: 77 passed with duplicate benchmark skipped). Updated SSR assertions also passed on Node. An initial Workers test invocation hit the shell's 120-second timeout; rerunning with a 300-second timeout completed. A pre-existing Playwright assertion message was moved to `expect(locator, message)` to fix the installed API's TypeScript error and allow `npm run build` to pass. Lint was rerun sequentially after a transient race with Playwright recreating `test-results`.

Final checks: `npm test` **132 passed**, `npm run lint`, both production builds, both browser runtimes, public-asset scan, and `git diff --check` passed. Fixture routes were removed and normal artifacts rebuilt. Run the two builds **sequentially**: vinext also generates `.next/types/routes.d.ts`, so concurrent Next/vinext builds can race and fail Next's type validation. The isolated runner already uses sequential builds.

References inspected: [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/), [PostgreSQL drivers](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), and the installed cf binding declarations / Prisma adapter implementation.
