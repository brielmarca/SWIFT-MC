# Staging public image cache: isolated gateway fix

## Why

On 2026-11-16, a public versioned rank image returned HTTP 200, `Content-Type: image/webp`, `Cache-Control: private, no-store`, `CF-Cache-Status: UPDATING`, and a nonzero `Age` on `staging.swiftmc.com.br`. The HTML homepage returned `private, no-store` and `DYNAMIC`, which is correct for the current session-aware frontend.

The Node build already configures `/brand/ranks/*-v2.webp` with long-lived caching, but Cloudflare's external staging gateway can still pass through mismatched headers from upstream/edge caches. `deploy/staging-gateway.ts` therefore enforces the intended **public asset only** policy when responses are demonstrably safe.

## Scope and guardrails

- Only repository-controlled `/brand/<safe-slug>[...].(webp|avif|png|jpg|jpeg|svg|ico)` with **no query string** can receive an overridden cache policy.
- Strip viewer cookies and authorization **on these static brand fetches only**, so origin responses cannot accidentally depend on session data.
- Cache only GET/HEAD, HTTP 200 responses with an `image/*` content type, no `Set-Cookie`, no `Vary: Cookie`, `Vary: Authorization` or `Vary: *`.
- Explicit versioned rank art gets `public, max-age=31536000, immutable`; other brand images get `public, max-age=86400, stale-while-revalidate=604800`.
- All account/admin/order/payment endpoints continue to get `private, no-store`; errors or ambiguous responses fail closed.
- Do not replace files with `-v2` names: increment asset filename and update references whenever artwork changes.
- This does not make site HTML publicly cacheable and does not add new analytics or alter DB/auth/payment code.

## Deployment — NOT part of the Docker image

**Important:** `deploy/staging-gateway.ts` is a separate **Cloudflare Worker**, not the Next.js backend inside the VPS Docker image. Updating `STAGING_IMAGE_TAG` alone will **not** apply this gateway fix. Once the GitHub PR is merged, the owner should update the gateway from a trusted local checkout and the existing Cloudflare account (do not send API tokens in chat):

```bash
git fetch origin deploy/p7-staging-vps
git switch deploy/p7-staging-vps
git pull --ff-only origin deploy/p7-staging-vps
# Verify account/project before deploying. Preserve existing Worker secrets.
npx wrangler whoami
npx wrangler deploy --config deploy/wrangler.staging.jsonc
```

**Cloudflare cache state:** After worker deployment, use **Caching → Configuration → Purge Cache → Custom Purge (URLs)** for the single affected URL `https://staging.swiftmc.com.br/brand/ranks/swift-v2.webp`. Depending on Cloudflare Worker subrequest cache configuration, the cached upstream entry may also be stored under `https://staging-origin.swiftmc.com.br/brand/ranks/swift-v2.webp`. Purge only those exact public URLs, if needed, not all cache / DNS / sessions.

Verify:
```bash
curl -sSI https://staging.swiftmc.com.br/brand/ranks/swift-v2.webp | grep -Ei '^(HTTP/|cache-control:|cf-cache-status:|age:|content-type:)'
curl -sSI https://staging.swiftmc.com.br/ | grep -Ei '^(HTTP/|cache-control:|cf-cache-status:|content-type:)'
```
Expected: versioned image cache-control `public, max-age=31536000, immutable`; homepage `private, no-store`. The first image request after purge might be `MISS` or `DYNAMIC` depending on current Cloudflare cache rules; a real `HIT` after repeated requests depends on Cloudflare settings, not just the presence of a header. Confirm no personalized response is cached.

## Safety and rollback

- First deploy only to **staging**; do not change the production Worker.
- Existing worker account/route/secrets must be verified before deployment.
- Rollback the gateway from the previous `deploy/p7-staging-vps` commit if unexpected, without touching the database.
- Existing 97 mobile / 99 desktop Lighthouse scores are user-reported; this fix is not expected to substantially increase scores and should be evaluated using headers, not assumed to improve Core Web Vitals.
