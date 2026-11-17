# Swift MC — Cloudflare Turnstile + anti-bot rollout

## Protection implemented

When `TURNSTILE_ENABLED=true`, require a fresh Cloudflare Turnstile token for:
- `POST /api/register` and `POST /api/auth/resend-verification` (action `register`).
- `POST /api/login` (action `login`).
- `POST /api/password-reset/request` (action `forgot`).
- `POST /api/auth/discord/start` for `LOGIN` (actions `login` or `register`). Authenticated Discord `LINK` retains its existing session/CSRF/rate-limit controls.

The backend validates the one-use token with Cloudflare Siteverify **before** account lookups,
email issuance, authentication or OAuth transaction creation. It checks `success`,
the **exact APP_URL hostname**, and `action`. All failure, timeout, bad key and missing
token cases fail closed; backend errors never expose the Turnstile secret.
Existing CSRF/origin checks and IP/email rate limits remain in place and are checked
before Siteverify, reducing malicious verification traffic.

## Production configuration (required before activation)

1. In Cloudflare Dashboard → **Turnstile** → Add widget, select **Managed** and
   authorize the hostname **swiftmc.com.br**. Create a separate widget for staging
   with its own hostname. Record the **site key** (public) and **secret key** (private).
2. Configure both frontend and backend with the matching settings:
   - `TURNSTILE_ENABLED=true`
   - `TURNSTILE_SITE_KEY=<public site key>`
   - `TURNSTILE_SECRET_KEY=<private secret>` **only on the backend**.
3. **Node/VPS production:** Add all three values to private `deploy/production.env`
   (or the actual injected production environment); secure it with file mode 600,
   never commit this file. Restart/redeploy the backend only after verifying its env.
4. **Cloudflare Workers frontend:** Set `TURNSTILE_ENABLED=true` and
   `TURNSTILE_SITE_KEY` as non-secret *build* configuration, then deploy.
   `cloudflare.config.ts` declares matching runtime text bindings. If the Worker
   also processes authentication, provision `TURNSTILE_SECRET_KEY` using Cloudflare
   **Secrets**, never an ordinary text binding and never `NEXT_PUBLIC_`.
   This project conditionally declares that secret when enabled.
5. Verify production host and proxy routing: the login page must have the same
   widget site key as the backend's secret. The backend's `APP_URL` must be
   `https://swiftmc.com.br` so hostname checking cannot accept cross-site tokens.
6. **Activate backend and frontend in a controlled rollout.** Until enabled, behavior
   remains as before. If frontend is active but backend is not, protection is bypassed;
   if backend is active but frontend is not, login/registration will fail.
   Roll back `TURNSTILE_ENABLED=false` on both layers together if necessary.
   Do not put official always-pass testing credentials in production.

Test cases: human registration and email delivery, invalid/missing/expired/replayed
tokens (`403`), incorrect hostname/action (`403`), Cloudflare outage (`503`),
existing IP and email rate limits (`429`), Discord OAuth login, linked Discord account
flow and mobile Safari. Observe Siteverify validation metrics in Turnstile Analytics.

## Mitigate traffic spikes at the edge

Turnstile blocks scripted form submissions. **It is not volumetric DDoS protection.**
For spikes and GET floods enable Cloudflare DDoS protection/Bot Fight Mode and
configure **one WAF rate limiting rule** for the public hostname and the sensitive
POST paths above. Suggested starting point: challenge/block IPs producing more than
20 matching requests in 60 seconds, then tune against real traffic; avoid challenging
ordinary GET pageviews, Stripe webhooks, Minecraft bridge/internal endpoints, or
`/api/auth/discord/callback`. Keep the application's fail-closed 10-per-minute
rate limits, and monitor 429/403/503 and abuse patterns. On Free plans, rule count
and characteristics are limited; verify availability in the Cloudflare dashboard.

Example Cloudflare expression (adapt based on the Cloudflare edge path mapping):

```text
(http.host eq "swiftmc.com.br" and http.request.method eq "POST" and
 http.request.uri.path in {"/api/register" "/api/auth/resend-verification"
 "/api/login" "/api/password-reset/request" "/api/auth/discord/start"})
```

CSP includes `https://challenges.cloudflare.com` in `script-src`, `frame-src`,
and `connect-src`. Keep `frame-ancestors 'none'` unchanged.

References:
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://developers.cloudflare.com/turnstile/reference/content-security-policy/
- https://developers.cloudflare.com/use-cases/solutions/stop-account-takeover-attacks/
