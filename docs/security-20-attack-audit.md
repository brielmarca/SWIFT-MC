# SwiftMC security verification — 20 attack classes (2026-11-17)

Scope: authorized SwiftMC repository, production Cloudflare gateway, anonymous read-only endpoint probes. This is a regression assessment, **not** a certificate of pentest. Never stress-test production or fuzz real payments/accounts.

| # | Attack class | Control and evidence | Residual / next step |
|---|---|---|---|
| 1 | HTTP/2 Rapid Reset | Cloudflare edge HTTP DDoS mitigation | Verify monitoring and rules; no production load attack. |
| 2 | 52-char username | Java Minecraft usernames are 3–16 ASCII; production returned 400 | Regression test added. |
| 3 | SAML bypass | No SAML provider or endpoints present | N/A until added. |
| 4 | nOAuth email spoof | Discord OAuth uses state, PKCE and provider subject, not a declared email | Test with controlled OAuth identities in staging. |
| 5 | GraphQL aliases | No GraphQL API found | N/A until added. |
| 6 | 2FA replay | Atomic lastUsedStep update prevents duplicate TOTP | Verified in MFA tests; staging authenticated verification recommended. |
| 7 | ReDoS | Bounded DTO fields; no dynamic RegExp in application | Staging-only performance fuzzing. |
| 8 | JWT alg confusion | Website uses server-stored random opaque session tokens, no login JWT | Revisit on any new JWT integration. |
| 9 | Request smuggling | Gateway strips hop-by-hop headers, caps body, refuses dual TE/CL | Verify Cloudflare Managed Rules coverage. |
| 10 | Cache poisoning | Dynamic/private gateway responses use no-store; CDN overrides removed | Audit Cloudflare cache rules. |
| 11 | Spoofed IP header | Gateway removes untrusted forwarding and proxy IP headers | Cloudflare must overwrite CF-Connecting-IP; private-key origin remains required. |
| 12 | RLS views bypass | No SQL views or RLS policy found; owner scoping via application | Periodic IDOR and user-scope tests; revisit if views added. |
| 13 | Math.random tokens | Security tokens and MFA secrets use crypto.randomBytes | Preserve for future tokens. |
| 14 | Timing attack | timingSafeEqual for secret comparisons and CSRF | Differential timing tests only on staging. |
| 15 | Padding oracle | AES-256-GCM protects MFA/OAuth stored secrets | Preserve authenticated encryption. |
| 16 | Prototype pollution | Forged object keys rejected in order/cart, strict metadata | Expand tests as object merging features are added. |
| 17 | Template injection | No eval/new Function or dynamic template engine found in core | Review future CMS/rich-text renderers. |
| 18 | XXE | No XML parser endpoint found | N/A until XML ingestion added. |
| 19 | WebSocket hijack | No WebSocket upgrade/handler found | N/A until real-time sockets added. |
| 20 | Unicode / username spoofing | Minecraft IDs strict ASCII 3–16; auth email rejects Unicode | Display names must not be treated as authorization identities. |

## Files changed

- deploy/gateway-security.ts: proxy boundary, noindex allowlist and private response cache rules.
- deploy/production-gateway.ts: HSTS, dual request framing rejection and canonical production indexing.
- deploy/staging-gateway.ts: same transport protections; staging always noindex.
- lib/auth/middleware.ts and lib/auth/csrf.ts: constant-time comparison and token bounds.
- tests/gateway-hardening.test.ts: malformed framing, headers, CSRF, cache, SEO, Unicode and staging isolation.
- scripts/check-public-security.mjs: safe read-only smoke probes with short timeouts.

## Cloudflare configuration checklist

Cloudflare HTTP DDoS mitigation covers HTTP/2 Rapid Reset at the edge. Cloudflare Managed Rules include an HTTP/2 Request Smuggling - Request Body Anomaly detection promoted to Block in August 2026. Validate this rule and the deployed managed ruleset in the zone dashboard. Confirm rate limiting, WAF events, alerts, bot management options and Cloudflare Tunnel/origin isolation. No zone-level WAF change was made by repository code.

References:
- https://developers.cloudflare.com/ddos-protection/about/attack-coverage/
- https://developers.cloudflare.com/changelog/post/2026-08-25-waf-release/
- https://developers.cloudflare.com/waf/managed-rules/
- https://developers.cloudflare.com/waf/feature-interoperability/

## Validation and release

1. Run npm run typecheck and npm test, then eslint on changed sources.
2. Build the Worker using npx wrangler@4.160.0 deploy --config deploy/wrangler.production.jsonc --dry-run.
3. Deploy the production gateway only, without modifying runtime secrets, Stripe, database or Cloudflare Tunnel.
4. Run node scripts/check-public-security.mjs and inspect whether public pages lose noindex while private routes keep noindex/no-store.
5. Verify WAF managed-ruleset status through Cloudflare Dashboard Security > WAF > Managed rules with suitable access.
6. Exercise authenticated flows and destructive protocol fuzzing only in isolated staging.

Residual risk: the CSP still includes script unsafe-inline for framework compatibility; migrate to nonce/hash-based scripts separately. HTTP/2 rapid reset and request-smuggling resilience cannot be proven by a small number of endpoint requests. A passing suite is not equivalent to a third-party penetration test.

## Execution record — 2026-11-17

- Node unit/security regression suite: **433/433 passed**.
- TypeScript typecheck, full ESLint, Next.js production build: **passed**.
- Wrangler production Worker dry-run bundling: **passed** (no deploy).
- Live read-only public smoke baseline: **6/10 passed**, **4 public SEO/HSTS checks failed**, as the updated gateway is not deployed.
- Production Wrangler access: authenticated session reported an OAuth account that does not authorize the production Worker account; secret-list request failed with API authentication error 10000. **No production deploy attempted and no secrets modified.**
- PostgreSQL integration command: not run to completion; disposable-cluster prerequisites initdb, pg_ctl and createdb are missing on this workstation.
- Browser suite: **142 passed, 20 skipped, 0 failed** across desktop and mobile. Test expectations were aligned with the existing Discord login label, fail-closed OAuth behavior and Cash disabled message.

The source fix for noindex/HSTS cannot change the live response until the correct Cloudflare account grants Worker deployment permission. Do not assume the public SEO issue is fixed in production.
