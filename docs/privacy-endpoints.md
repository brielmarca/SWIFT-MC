# SwiftMC privacy endpoints — draft PR #15

These endpoints use authenticated sessions, origin and CSRF protections on mutations, strict bounded JSON, MFA for administration, and PostgreSQL durable storage. **Staging migration must be applied before deployment.** Do not use production credentials in scripts or tests.

| Endpoint | Method | Access | Result |
|---|---|---|---|
| `/api/user/privacy-requests` | GET | Active authenticated account | Up to 50 of your own requests, redacted details |
| `/api/user/privacy-requests` | POST | Active authenticated account + Origin + CSRF + rate limit | Create or return pending duplicate. Body: `{"kind":"ACCESS","details":"optional"}` |
| `/api/user/privacy-requests/{id}` | GET | Owner account only | Your request including its optional description |
| `/api/admin/privacy-requests?page=1&status=OPEN` | GET | Active ADMIN/OWNER + MFA + `audit:read` | 25 records, `hasNext` |
| `/api/admin/privacy-requests/{id}` | PATCH | Active ADMIN/OWNER + MFA + Origin + CSRF | Status transitions with optimistic concurrency and audit |

For the PATCH endpoint:
- `{"action":"START_REVIEW","expectedStatus":"OPEN"}` -> IN_REVIEW
- `{"action":"RETURN_TO_QUEUE","expectedStatus":"IN_REVIEW"}` -> OPEN
- `{"action":"COMPLETE","expectedStatus":"IN_REVIEW","attested":true}` -> CLOSED (**OWNER only**, after actual external fulfillment)
- `{"action":"REJECT","expectedStatus":"IN_REVIEW","attested":true}` -> REJECTED (**OWNER only**, after legal review)

Completion/rejection requires explicit manual attestation. An audit entry records the actor, affected account, kind, outcome and new status without retaining raw request bodies. This endpoint does **not** export user information, delete accounts, alter payments, revoke Minecraft benefits or issue refunds. The API cannot independently prove that the external work occurred. Keep real legal approvals, documented decisions and secure notifications off this API until a separately reviewed implementation is ready.

## Validation
- Unit tests cover status transitions, query validation and stream limits.
- Run existing `npm run typecheck`, `npm test`, `npm run test:db`, `npm run test:browser` and security journeys on disposable staging.
- Test anonymous requests, permission denials, MFA-required, Origin/CSRF failures, cross-account reads, concurrent PATCH updates and replay/duplicates.
- Do not deploy code against an unmigrated database. Production payments remain disabled.
