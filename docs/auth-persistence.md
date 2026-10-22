# Authentication persistence reference

Status: **schema and unapplied SQL source only**. Authentication remains unavailable.
This reference is for maintainers reviewing the persistence boundary before a real
PostgreSQL staging environment exists. It does not start Phase C.

## Sources and migration boundary

- Schema: `prisma/schema.prisma`.
- Migration: `prisma/migrations/20261022000000_auth_persistence/migration.sql`.
- Existing infrastructure: [auth-infrastructure.md](auth-infrastructure.md).

The SQL was prepared using a database-free Prisma datamodel diff against the
commerce-only schema, followed by hand-authored CHECK constraints and triggers.
It creates nine tables, five enums, indexes, foreign keys and safeguards in one
transaction. It contains no commerce alterations, backfill, seed accounts or grants.
It has **not been executed or validated by a PostgreSQL server**.

`DIRECT_DATABASE_URL` remains the Prisma CLI/admin migration connection, through
the existing `directUrl` and `scripts/prisma-direct.mjs` boundary. It is not a
Worker binding. Future runtime auth access uses the request-scoped
`AUTH_HYPERDRIVE` client with caching disabled on the real Hyperdrive resource.
No URL, database, resource ID or binding has been provisioned by this change.

This is a pending migration in the normal migration directory: a future migration
deployment will include it. Do not deploy it until staging verification below is
complete. Do not use `db push` as a substitute: it would omit custom SQL safeguards.

## Models and relations

| Model | Purpose and relations |
| --- | --- |
| `User` | Website account, optional normalized email and verification time, display name, server-owned role/status and auth version. Has identities, sessions, challenges, link transactions and optional Minecraft identity. |
| `AuthIdentity` | Belongs to one user. Provider plus stable subject identifies the credential owner. Last authentication is nullable until first success. |
| `PasswordCredential` | Optional one-to-one identity child; `identityId` is both PK and FK. Stores only a password hash and change time. SQL limits its parent provider to `EMAIL_PASSWORD`. |
| `Session` | Belongs to one user; unique token hash, auth-version snapshot, idle/absolute expiry, revocation and authentication timestamps. No device metadata is collected. |
| `AuthBrowserContext` | Pre-authentication browser state: token hash, CSRF token hash and expiry. Has OAuth transactions. |
| `OAuthTransaction` | Required browser context; optional link user and initiating session. Contains state hash, encrypted PKCE verifier, return path, intent, expiry and consumption timestamp. |
| `EmailChallenge` | Optional user association, normalized target email, purpose, token hash, optional auth-version snapshot, expiry and consumption timestamp. |
| `MinecraftIdentity` | One verified identity per user initially. Namespace plus canonical subject identifies the game account; username is display metadata only. |
| `AuthAuditEvent` | Optional actor and subject user relations, bounded event/outcome/request identifiers, JSON metadata and creation time. |

Enums:

- `UserRole`: `USER`, `SUPPORT`, `MODERATOR`, `ADMIN`, `OWNER` (default `USER`).
- `UserStatus`: `ACTIVE`, `SUSPENDED`, `DELETED` (default `ACTIVE`).
- `AuthProvider`: `EMAIL_PASSWORD`, `DISCORD`.
- `OAuthIntent`: `LOGIN`, `LINK`.
- `EmailChallengePurpose`: `REGISTER`, `VERIFY_EMAIL`, `CHANGE_EMAIL`, `PASSWORD_RESET`.

All model IDs are strings. New IDs use Prisma's `cuid()` except the credential's
shared identity PK. These defaults and `@updatedAt` are Prisma-client behavior;
future raw SQL writers must supply IDs and `updatedAt` explicitly. Every auth
timestamp, including nullable timestamps, uses `Timestamptz(3)`.

User ownership relations use `RESTRICT` on deletion, supporting soft deletion via
status and preventing accidental removal of security state. Credentials cascade
when their identity is deliberately deleted; OAuth transactions cascade with their
browser context. Audit actor/subject references become null on deliberate physical
user deletion, retaining the event. All auth FK updates use `RESTRICT`. Future
retention work must delete expired OAuth transactions before their initiating
sessions. No implicit account cleanup job is introduced here.

## Uniqueness and indexes

- `User.emailNormalized` is unique; PostgreSQL permits multiple null values.
- `AuthIdentity(provider, providerSubject)` prevents duplicate provider ownership;
  `(userId, provider)` initially permits only one identity per provider per user.
- Credential PK prevents more than one password credential per identity.
- Session/browser-context/challenge token hashes and OAuth state hashes are unique
  within their respective tables.
- `MinecraftIdentity.userId` is unique, as is `(namespace, subject)`.
- Session indexes cover `userId`, `idleExpiresAt`, `absoluteExpiresAt`, `revokedAt`.
  The revocation index is a normal B-tree, expressible in Prisma without a partial
  index. Tune against actual staging query plans later.
- Browser context, OAuth transaction and email challenge expiry indexes support
  cleanup; challenge `(emailNormalized, purpose)` supports challenge lookup.
- OAuth has explicit browser-context, link-user and initiating-session FK indexes.
- Audit actor/subject indexes begin with the FK and then creation time; request ID
  and creation time also have indexes.
- Every FK has either an explicit index or a PK/unique index with the FK as its
  leftmost column. Redundant indexes were avoided for identity/credential/Minecraft.

## Enforcement layers

### Prisma schema and generated PostgreSQL structure

Required fields, native enum domains, default role/status/version, foreign keys,
one-to-one cardinality, bounded string columns, timestamp types and uniqueness are
declared in Prisma. There are no plaintext password/bearer-token fields and no
Discord access/refresh-token fields. The PKCE verifier has a ciphertext-only field.
There are no MFA tables; `mfaVerifiedAt` is reserved and must remain null until a
separately approved MFA implementation exists.

There is no relation from auth to `Order`, `Payment`, `PaymentEvent` or
`Fulfillment`. Neither email nor Minecraft username establishes order ownership.

### Custom SQL prepared for later application

Prisma 6 cannot describe these CHECKs or triggers. They are already included in
the unapplied migration, rather than left as an undocumented implementation task:

| Safeguard | Reason |
| --- | --- |
| Positive user/session auth versions; positive challenge version when present | Prevent invalid revocation-version snapshots. |
| Nonempty, lowercase, trimmed email when present | Protect normalized-email uniqueness; full email validation remains server-side. |
| Verified timestamp requires a user email | Avoid claiming verification without an email address. |
| Nonblank provider subjects, password/token/state/CSRF hashes, PKCE ciphertext and Minecraft identity components | Reject absent security identifiers disguised as empty strings. Does not prove hashing/encryption. |
| Session `createdAt < idleExpiresAt <= absoluteExpiresAt`; context/transaction/challenge `createdAt < expiresAt` | Prevent internally inconsistent lifetimes. |
| Consumption timestamp is null or at/after creation | Reject consumption predating creation. |
| Revocation reason is null or nonblank with a revocation timestamp | Prevent reason-only apparent revocation; revocation without a reason remains allowed. |
| LOGIN has no link user/session; LINK requires both | Keep login and explicit account-linking contexts separate. |
| Audit metadata must be a JSON object whose PostgreSQL text serialization is at most 4096 bytes | Bound optional audit data; sanitization is still a writer obligation. |
| Auth identity trigger makes provider, provider subject and user owner immutable on update | Prevent identity reassignment or provider changes after credential creation. Explicit unlink/relink requires a separate authorized operation. |
| Password credential trigger requires an `EMAIL_PASSWORD` parent | Enforce the cross-table credential type invariant. Provider immutability prevents a later change invalidating it; the FK covers deletion races. |

Native PostgreSQL enums already enforce allowed role/status/provider values, so
duplicate enum CHECKs add no protection. No rule forces a suspended/deleted user
to lose their stored role: authorization must independently reject non-active
users. There are no `NOW()`-based CHECKs; rows naturally expire without becoming
invalid database rows. Consumption is not constrained to precede expiry because
invalidation/cleanup may mark expired entries consumed. A future redeem operation
must independently require an unexpired, unconsumed row.

### Future trusted server responsibilities (not enabled)

- Never accept client-selected `userId`, role, status or `authVersion`. Public
  request schemas must omit these fields and authorization must run server-side.
  Prisma types/defaults are not an authorization mechanism.
- Never derive website staff roles from purchases, Minecraft VIP ranks, Discord
  display names or Minecraft usernames. Roles are controlled by trusted website
  administration only.
- Generate random bearer/state/challenge secrets and persist only cryptographic
  hashes. Store password hashes only in `PasswordCredential`; never place passwords,
  hashes, bearer tokens, CSRF secrets, OAuth codes/tokens or PKCE plaintext in audits.
  Encrypt PKCE verifiers with authenticated encryption and an external key. Login-only
  Discord OAuth must discard access/refresh tokens after its bounded identity use.
- Normalize and validate email before lookup/write. Do not treat a matching email
  as proof that two identities belong to the same person; explicit linking is required.
- Validate Discord's stable subject from the verified provider response. Persist
  Minecraft namespace and subject in exactly one canonical form before lookup/write:
  for a UUID namespace, parse a UUID and serialize lowercase with a fixed hyphen
  convention. Never use a player name as subject. The composite unique keys protect
  concurrent claims of the **same canonical key**; they cannot normalize aliases.
- For LINK, verify that `initiatingSession.userId === linkUserId`, that the session
  is active and sufficiently recent, and that the browser context is bound to the
  request. FKs only prove those rows exist, not their cross-row ownership equality.
- Compare session/challenge version snapshots with the current user's version,
  check status/revocation/expiry, and consume single-use transactions/challenges
  atomically with the corresponding state change. Snapshot equality cannot be a
  CHECK: old sessions must remain representable after version increments.
- Validate `returnPath` through the existing local-return-path policy before storage
  and redirect. A bounded string is not an open-redirect defense.
- Allowlist and sanitize audit metadata keys/values, reject sensitive payloads,
  and enforce the 4 KiB serialized limit before writing. JSON shape/size checks
  cannot determine whether a string contains a secret. Audit event/outcome codes
  must come from a future server-owned taxonomy, not arbitrary client data.

## Verification and pending PostgreSQL work

Completed locally without connecting Prisma to a database:

- `npx prisma validate`: passed with process-only, inert loopback URLs for
  `DATABASE_URL` and `DIRECT_DATABASE_URL`. The initial unconfigured invocation
  failed because `DIRECT_DATABASE_URL` is absent, as intended by the tooling boundary.
- `npx prisma generate`: passed with Prisma 6.19.3.
- `npm test`: 138 passed, including the commerce `DEMO_ONLY` regression tests.
- `npm run lint`, `npm run build`, `npm run build:vinext`: passed.
- `git diff --check`: passed; new SQL and documentation were also checked for
  whitespace errors with `git diff --no-index --check`.

The offline diff used a temporary copy of the prior commerce datamodel with
`prisma migrate diff --from-schema-datamodel <baseline> --to-schema-datamodel
prisma/schema.prisma --script`. Neither input was a database URL. No migration
`dev`, `deploy`, `status`, `reset` or `db push` command was run.

Pending real PostgreSQL staging: apply the full migration history through the
direct admin boundary; verify SQL syntax, triggers, enum types and indexes;
exercise duplicate provider/Minecraft claims (including concurrent attempts),
multiple null emails, invalid credential providers, immutable identity updates,
expiry/revocation/consumption checks, metadata size limits, FK deletion behavior
and transaction rollback. Verify the custom objects survive later migrations.
Prisma validation and generation do not exercise any of these database behaviors.
Separately verify a real cache-disabled Hyperdrive binding before runtime use.

Rollback strategy: before commit, PostgreSQL rolls back this migration as a unit.
After successful deployment, prefer leaving these unused additive tables in place
while reverting application code. Removal requires a separately reviewed forward
migration that accounts for stored auth data and drops triggers/functions as well
as tables/enums; there is no automatic destructive down migration.

Commerce models and earlier migrations are unchanged. Commerce stays `DEMO_ONLY`.
The four auth pages remain unavailable/unwired; no auth endpoints, login/register
implementation, OAuth activation, MFA implementation or Phase C work is included.
