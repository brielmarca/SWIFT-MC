# SwiftMC — production release gates (not a compliance certificate)

The development branch must not automatically deploy or enable payments. Deploy only after technical review, backup/rollback and authorized sign-off.

## Before any production rollout
1. Recheck Cloudflare DNS for `swiftmc.com.br` and `www`; verify public HTTPS, HSTS at the edge, tunnel origin and header behavior. A successful staging localhost check does not prove public TLS.
2. Verify PostgreSQL recovery: encrypted offsite backup, restore rehearsal, retention owner and failure alerting.
3. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit --omit=dev --audit-level=high`. Run the existing PostgreSQL integration and Playwright suites on disposable environments.
4. Run WCAG-focused keyboard navigation, accessible names, image licensing and contrast checks on mobile and desktop. Existing alt/ARIA attributes are not a certification.
5. Perform API authorization/CSRF/XSS/injection tests, dependency updates and review production CSP and headers; never remove `unsafe-inline` until Next/vinext runtime supports the alternate CSP configuration and tests pass.
6. Approve final privacy, terms, refund policy and real operator details. Publish accessible data-subject contact, processors/bases/retention summary and minors policy. Test request-response workflows.
7. Confirm real payment test flows and entitlement lifecycle (Stripe live/test separation, signed webhooks, idempotency, refunds, chargebacks and Minecraft Bridge). Keep `PURCHASES_ENABLED=false` until approved.
8. Review monitoring, incident response, security logging and staff access least privilege. Stage rollout with rollback and observe errors.

## Privacy request launch
Run Prisma migration `20261116220000_privacy_requests` in a controlled migration job **before** deploying app code that queries `PrivacyRequest`. Confirm the existing `User` relation stays valid and RBAC/MFA guards are enforced. If migration fails, do not deploy the new UI/API. No auto-delete/export feature is allowed without a separately reviewed policy and integration tests.

## Deferred — Cloudflare Turnstile CAPTCHA
After core fixes, evaluate Turnstile on registration, login, forgot-password and resend/verification endpoints. **Always** verify token server-side with Cloudflare Siteverify using a secret kept in server-only environment, bind to expected action/hostname, use short-lived single-use tokens, fail closed on invalid responses, retain rate limiting and add non-JavaScript/accessibility fallback. Never expose the secret or accept client-side validation alone. Staging/test keys must be isolated from production keys. 

## Critical vulnerability resolved in this branch (pending CI validation)
The previous lockfile included react-server-dom-webpack 19.3.0 (CVE-2026-126187 / GHSA-xqc2-xf4c-x3h3, critical). The direct dependency and lockfile now target 19.3.1 alongside React and React DOM 19.3.1, using integrity hashes from the public vitejs/vite-plugin-react pnpm lockfile. **Do not mark remediated in deployed environments until `npm ci`, `npm audit`, build and production deployment are validated.** Rebuild fresh runtime images; old containers remain vulnerable.

## Endpoint release gate
The privacy and admin APIs documented in `docs/privacy-endpoints.md` require authorization/CSRF/MFA and concurrent-write tests in staging. Admin status transitions do not equal actual delivery or deletion. Keep domain DNS, TLS and production release changes separate from this PR.
