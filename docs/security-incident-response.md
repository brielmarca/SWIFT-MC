# SwiftMC — security incident response playbook (draft)

This is an engineering runbook; not a determination of legal notification requirements. Must be reviewed by the actual operator and legal counsel.

## 1. Detect and contain
- Monitor auth/MFA failures, privilege changes, anomalous Stripe signatures, unusual Bridge deliveries, provider webhook failures, unexpected database access, backup failures and public site availability.
- Identify the affected environment **before** taking action. Keep staging and production credentials, DBs and webhook secrets separate.
- For suspected compromise: restrict exposed access, rotate affected secrets through authorized channels, revoke sessions where appropriate, preserve audit evidence and temporarily keep `PURCHASES_ENABLED=false` until the payment flow is verified. Do not erase logs or production data as a containment shortcut.

## 2. Preserve evidence
- Record timestamps in UTC, affected systems/users, indicators, authorized responder, exact change, ticket ID and incident chronology. Do not put personal information, authentication tokens or entire payment webhook bodies in public issues or chat.
- Export sanitized system metrics, redacted app logs and immutable snapshots for authorized investigation. Protect access to evidence.

## 3. Assess and communicate
- Determine whether personal data, payment processing or Minecraft entitlements were impacted, whether data left authorized boundaries and what risks to individuals may arise. Engage legal/privacy owners and processors.
- Evaluate notifications to ANPD, individuals and service providers under the law and applicable current regulations. Do not publish an automatic blanket deadline; record the decision, basis and required timeline in the incident record.
- Provide factual updates through a verified, authenticated official channel. Never invent scope or imply full resolution without evidence.

## 4. Recover and learn
- Verify secrets rotated, vulnerabilities corrected, isolated restore tested, data reconciled, tests pass, monitoring alerts operational and affected users have appropriate guidance.
- Reconcile Stripe payment statuses, database orders, delivery idempotency and Minecraft grants before re-enabling sales.
- Write a post-incident report and assign corrective actions/owners.

## Launch gates
Assign an on-call responder, an escalation contact, alerting/notification channels and a tabletop exercise. This file alone does not constitute an operational response process.
