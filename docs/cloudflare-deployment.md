# SwiftMC on Cloudflare Workers / vinext

Deployment reference and verification guide for maintainers. Payments remain paused. Public pages do not require a database or payment credentials.

## Deployment configuration

`cloudflare.config.ts` is the source of truth, not a generated Wrangler file.

| Setting | Value |
| --- | --- |
| Worker | `swift-mc` |
| Entrypoint | `vinext/server/fetch-handler` |
| Compatibility date | `2026-10-07` |
| Compatibility flag | `nodejs_compat` |
| Vite environments | `rsc`, with `ssr` as a child; client assets built separately |
| Static assets binding | `ASSETS` |
| Image optimization binding | `IMAGES` |
| Unknown asset handling | `none`, allowing application routing/404 handling |

The date supports Node compatibility and runtime `process.env` population from text/secret bindings. Keep the explicit compatibility flag. `runtime = "nodejs"` in an App Router route is not proof of Workers support: the actual runtime must support each imported API.

The installed Cloudflare Vite plugin and `cf` CLI are beta versions. Install with `npm ci` to use the reviewed lockfile rather than refreshing versions during deployment. Use Node.js 22.12+ or a supported newer LTS for the build tools; deployed requests run in Workers, not Node.js.

### Commands

```sh
npm ci
npm test
npm run lint
npm run build
npm run build:vinext
git diff --check
```

- `build` checks the retained Next.js build; it is not the Cloudflare deployment artifact.
- `build:vinext` runs `vite build` and generates Cloudflare Build Output under `.cloudflare/output/v0/`.
- `start:vinext` runs the built application in the local Workers runtime using `vite preview`.
- `dev:vinext` runs Vite/Workers development on port 3001.
- `deploy:vinext` runs `vinext-cloudflare deploy`, which builds and deploys the entry Worker using this configuration. It requires Cloudflare authentication and the correct account. Running the audit/build commands does not deploy anything.

Generated `.cloudflare/`, `.vinext/`, `.next/`, `.wrangler/`, `dist/`, `out/`, and `node_modules/` are ignored. Do not commit them. `.env*` and `.dev.vars*` are ignored, except the placeholder-only `.env.example`.

## Environment reference

**No application environment variables are required to render the public site.** Defaults and unavailable states are intentional. Cloudflare account authentication is required only for deployment.

| Variable | Where configured | Default / missing behavior | Exposure |
| --- | --- | --- | --- |
| `MINECRAFT_HOST` | Build/deploy environment or ignored `.env.production.local`; emitted as a Worker text binding | `play.swiftmc.net` | Server-side ping target. May become the displayed address when no public-address override exists. |
| `MINECRAFT_PORT` | Same as host | `25565`; invalid/out-of-range ports return offline with unknown counts | Server-side TCP target port |
| `MINECRAFT_PUBLIC_ADDRESS` | Same as host | Derived from the host and non-default port | Intentionally public: rendered in HTML and returned by the status API |
| `NEXT_PUBLIC_DISCORD_URL` | **Build environment**, before either build | Discord CTA becomes disabled when missing/invalid | Public build-time value. Only credential-free HTTPS URLs on `discord.gg` or `discord.com`, without a custom port, are accepted. Rebuild after changes. |
| `NEXT_PUBLIC_SITE_URL` | **Build environment**, before either build | `https://swiftmc.com.br` when missing/invalid | Public canonical HTTPS origin for metadata, social previews and sitemap. No credentials, custom port, path, query, local/private host. Rebuild after changes. |
| `MINECRAFT_DATA_API_URL` | Build/deploy environment or ignored `.env.production.local`; emitted as a Worker text binding | Blank disables stats, online list, and leaderboard integration | Server-only base URL. Use HTTPS without credentials, query, or fragment. |
| `MINECRAFT_DATA_API_TOKEN` | **Runtime Secret** on Worker `swift-mc` | Missing/invalid token produces `unavailable`, without contacting the data API or Mojang for stats | Private bearer token; never use `NEXT_PUBLIC_` or a text binding |

`cloudflare.config.ts` uses an explicit non-secret allowlist when loading configuration. It also sets the runtime `NODE_ENV` binding to `production` for builds, ensuring the localhost HTTP exception cannot be used in production. Values in a developer's shell are not automatically runtime bindings.

When `MINECRAFT_DATA_API_URL` is non-empty, the config declares `MINECRAFT_DATA_API_TOKEN` using `bindings.secret()`. This records a secret **name**, never its value, in Build Output. Provision that secret in Cloudflare before deploying the enabled integration. The CLI can reject deployment when a declared secret is missing, even though application requests handle missing credentials gracefully. With a blank API URL, no token is required for deployment.

Set the non-secret variables in the Cloudflare **build** environment as well as in local deployment builds. The generated bindings are authoritative on redeploy; a dashboard-only edit to a text binding is not a durable source of configuration. Changing only a runtime `NEXT_PUBLIC_DISCORD_URL` does not update the built site.

The private data token is not needed by the build. For local Workers testing of an enabled integration, supply it via an ignored `.dev.vars`/`.dev.vars.production` file or the local process environment. Do not upload a developer `.env` wholesale as Worker bindings: it includes unrelated database/payment settings.

Contract details: [Minecraft Data API](minecraft-data-api.md).

### SEO and browser identity

Set `NEXT_PUBLIC_SITE_URL=https://swiftmc.com.br` before building/deploying. It is a public value, not a secret. Both Next.js and vinext inline it at build time; it does not need a Worker runtime binding. Canonicals never derive from the incoming Host header or a localhost development URL.

- `/sitemap.xml`: public landing/network/content pages, all local ranks, published wiki guides, and news whose publication date has passed. No arbitrary player profiles, checkout pages, drafts, or invented modification dates. News visibility is evaluated per request.
- `/robots.txt`: permits the public site and disallows `/api/`. HTML noindex pages remain crawlable so crawlers can read their directives.
- `/manifest.webmanifest`: SwiftMC browser identity using the existing local emblem and black/purple colors. No service worker or offline/PWA behavior is added.
- `/player/[username]` and `/checkout` descendants use `noindex, follow`. Player profiles remain shareable with dynamic titles and social previews; `/player` itself is indexable. Missing content uses noindex metadata and the existing not-found behavior.
- Page metadata shares the `%s | SwiftMC` title template, canonical origin, Open Graph site identity and Twitter summary cards. Published articles use their existing local image when supplied; otherwise `/brand/emblem.png` is used. The near-square brand image is not represented as a wide social banner.

Submit `https://swiftmc.com.br/sitemap.xml` to Google Search Console after the production domain is connected. Indexing and social preview refresh timing are controlled by the respective crawlers.

## Runtime compatibility and failure behavior

| API | Runtime operations | Failure behavior |
| --- | --- | --- |
| `/api/server-status` | Request-scoped outbound `node:net.createConnection`, Buffer protocol parsing | 3-second deadline, 1 MiB response bound, validated payload. Connection errors, blocked sockets, malformed responses and timeouts produce `online: false` with `players`, `maxPlayers`, `version` set to `null`, never fabricated zeroes. |
| `/api/minecraft/profile` | Web `fetch` to fixed Mojang host | Username validation, 4-second timeout, 16 KiB response limit; normalized invalid/not-found/unavailable responses. |
| `/api/minecraft/avatar/[uuid]` | Web `fetch` to fixed Crafatar head/body endpoints | UUID/view validation, 4-second timeout, 64 KiB limit, PNG signature validation; generic 503 on upstream failure. |
| `/api/player/[username]/stats` | Mojang identity plus private HTTPS API | Validates identity and payload; 400 invalid, 404 not found, 503 unavailable. Each upstream request has a 4-second timeout. |
| `/api/players/online` | Private HTTPS API | 503 when integration/upstream is unavailable. Only a valid available empty array represents zero players. |
| `/api/leaderboards` | Private HTTPS API | Category/limit validation; 400 invalid, 503 unavailable. Only a valid empty board represents no entries. |
| `/api/orders` | Node crypto; lazily acquired Prisma client after validation | Import does not require `DATABASE_URL`. Unpriced ranks remain rejected. Database errors use the existing sanitized 503 response. |
| `/api/orders/[orderNumber]/payment` | Node crypto; lazy Prisma; provider HTTPS client | Existing token/order checks retained. Without database/provider configuration, returns the existing generic 503. No payment flow is enabled. |
| `/api/webhooks/mercadopago` | Signature validation, Node crypto, lazy Prisma | Existing envelope/signature checks retained. Missing configuration uses the existing generic 503; unsupported event types retain their existing acknowledgment. |

### Workers-specific restrictions

- Current Workers supports outbound `node:net` through its socket implementation. It does **not** provide a general Node server runtime or support `net.Server` in application code.
- The Minecraft origin must be publicly reachable. Workers blocks TCP destinations on Cloudflare IP ranges, localhost/private addresses, and prohibited ports. Use a DNS-only origin hostname or an appropriate public origin IP for `MINECRAFT_HOST`; keep the player-facing hostname in `MINECRAFT_PUBLIC_ADDRESS`. Configure the explicit port: this implementation does not perform Minecraft SRV discovery.
- The origin firewall must permit Workers egress; Workers TCP egress is not the published list of Cloudflare proxy IPs. A local TCP test does not establish production-origin reachability.
- Workers rejects `redirect: "error"`. Public upstream clients use `redirect: "manual"` and reject non-2xx responses, preserving the no-redirect policy without forwarding credentials to a redirected host.
- Short caches are isolate-local and not globally shared across Cloudflare locations. Socket objects are created per query and destroyed when it completes; they are not cached. Cache payloads are bounded, and unknown values stay `null`.
- Public pages never call Prisma. Database client construction is deferred until a validated database operation, inside existing error handling. This audit does not certify active database/payment operations: before resuming payments, separately verify Workers-compatible connection pooling, database networking, migrations, and provider flows.

## Manual Cloudflare setup

1. Select the intended account and existing Worker `swift-mc`. Configure deployment authentication (`cf auth login` locally or an appropriately scoped Cloudflare API token in CI); do not expose deploy credentials as application bindings.
2. Set the non-secret build variables from the table. If defaults are correct and no private data integration is ready, they may remain unset.
3. If enabling the read-only data integration, configure its HTTPS URL and create the runtime Secret `MINECRAFT_DATA_API_TOKEN` on `swift-mc` before deployment. This does not enable payments.
4. Ensure the `IMAGES` binding/service is available for the account; retain `ASSETS` and `IMAGES` in the source configuration. Local image optimization passed, but account entitlements must be checked in Cloudflare.
5. Verify the custom domain or `workers.dev` hostname and its routing. No production domain is hardcoded in the application deployment config.
6. Verify Minecraft origin DNS, port and firewall reachability from deployed Workers, and that the data API accepts its configured bearer token.
7. Keep database, Mercado Pago, webhook and fulfillment credentials unconfigured for this paused public deployment. Rank prices and checkout behavior are unchanged.
8. Deploy with `npm run deploy:vinext`, then verify the deployed version's bindings and the smoke checks below. No live deployment or remote account settings were changed by this audit.

## Verification checklist

Start the built Worker locally:

```sh
npm run start:vinext -- --host 127.0.0.1 --port 3200
```

Check `/`, `/play`, `/store`, all four `/ranks/[slug]` pages, `/player`, a player profile, `/status`, `/online`, `/leaderboards`, `/wiki`, a wiki guide, `/news`, a news article, `/events`, `/rules`, and `/faq`. They must render without `DATABASE_URL`. Check hydration/navigation and an optimized `next/image` response, not only HTTP 200 status.

With the data integration disabled, expect these responses:

```sh
curl -i http://127.0.0.1:3200/api/server-status
curl -i http://127.0.0.1:3200/api/players/online
curl -i 'http://127.0.0.1:3200/api/leaderboards?category=playtime'
curl -i http://127.0.0.1:3200/api/player/Notch/stats
```

- Status: 200 with the real ping result, or offline/unknown values if unreachable.
- Data endpoints: 503 with `{"status":"unavailable"}`, not empty arrays or zeroes.
- Invalid username/category/view requests: 400, without an upstream request.
- Unknown content/rank slugs: application 404.

Repeat against the actual deployment hostname. Verify profile/avatar success when their upstreams are reachable, data-service success with real configuration, and graceful failure if an upstream is down. Do not initiate payment transactions as part of this smoke check.

### Audit evidence

The local Workers audit exercised the generated production bundle with no database credentials, all public page types, browser hydration, and optimized images. A separate workerd test performed a real TCP handshake against a local Minecraft-protocol fixture and tested successful, unavailable, redirected, disabled, and disallowed-HTTP upstream configurations. A private build canary was absent from public assets, rendered pages, and serialized Worker output; the secret declaration contained only its name/type.

All five requested checks passed: `npm test` (103 tests), `npm run lint`, `npm run build`, `npm run build:vinext`, and `git diff --check`. A deployment packaging dry run also passed:

```sh
npx cf deploy --prebuilt --dry-run --mode production --worker swift-mc
```

The dry run reported 557.51 KiB gzip of Worker code and the expected asset/image/text bindings; it uploaded nothing and did not inspect live account configuration.

Build warnings about vinext static route classification (`?`) and ineffective dynamic imports are framework diagnostics, not observed deployment failures. Actual production DNS, account bindings, secret values, and upstream reachability still require verification in the Cloudflare account.
