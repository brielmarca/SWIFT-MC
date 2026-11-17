# SwiftMC — data inventory and decisions pending approval

Status: **working inventory, not a legal opinion or an approved LGPD program**. Owner/legal reviewer must verify each environment and vendor before live commerce.

| Data category | Purpose to validate | Where it appears | Retention decision |
|---|---|---|---|
| Display name, optional phone, verified email | Account and support | User/EmailChallenge | Pending approval |
| Password hashes, OAuth provider IDs, MFA secrets | Authentication and abuse prevention | AuthIdentity/PasswordCredential/MfaCredential | Pending approval |
| Sessions, browser CSRF context, security/audit logs | Account security | Session/AuthAuditEvent/AuthBrowserContext | Pending approval |
| Minecraft UUID, link codes, nickname | Verify benefit recipient | MinecraftIdentity/MinecraftLinkCode | Pending approval |
| Purchases, paid amounts, payment references, refunds | Order processing and legal obligations | Order/Payment/PaymentEvent | Pending approval |
| Entitlements, deliveries and acknowledgements | Deliver benefits and reconcile refunds | VipEntitlement/BridgeDelivery | Pending approval |
| Cancellation and privacy requests | Consumer/data subject service | OrderCancellationRequest/PrivacyRequest | Pending approval |
| Local browser cart and optional cookie choices | User experience and optional measurement | Browser localStorage | Pending approval |

Decisions required: identify the real controller, public support/privacy address, lawful basis **per purpose**, processors and their contracts, international transfers, minors' rights and appropriate safeguards, access logging and offsite backup retention. Document effective retention events (not just raw day counts), secure erasure and exception rules for accounting, fraud investigations and legal holds. Never publish sample identity details as real business facts.

## Current implementations
- `/account/privacy` registers authenticated data-subject requests without automatic disclosure/deletion; `/console-r7m4q9v2/privacy` shows them to MFA-protected admins for follow-up.
- Recording a request is **not** fulfilling it. Identity verification, response delivery, legal retention analysis and closing the request are manual until specifically implemented and validated.
- `/cookies` documents browser preference controls. Consent is stored locally, not as a durable centralized consent ledger.

## Pending approvals
- Operator information and legal contacts (actual name/legal entity and appropriate contact; CNPJ only if applicable). Do not expose a person's CPF by default.
- Final privacy/terms/refund language and rules for children/adolescents (especially Minecraft players).
- Contracts/agreements with Cloudflare, payment processors, mail providers, game hosting and any connected analytics service.
