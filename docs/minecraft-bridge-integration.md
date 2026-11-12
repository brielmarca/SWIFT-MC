# Swift MC Website ↔ Minecraft Bridge (0.2.0 contract)

Authoritative source of VIP ownership/payment state: **website + PostgreSQL**. The Paper plugin polls HTTPS and applies LuckPerms final state from absolute-expiration snapshots.

## Website endpoints (plugin contract)
All bridge endpoints require:
- `Authorization: Bearer <MINECRAFT_BRIDGE_SECRET>` (constant-time compare, server-side secret; never Stripe/DB secrets)
- `X-Swift-Server: <MINECRAFT_BRIDGE_SERVER_ID>` (must match configured server)
- JSON body, `Cache-Control: no-store`, no browser CORS assumptions

### `POST /v1/bridge/link`
Request:
```json
{ "serverId":"swift-survival", "playerUuid":"<uuid>", "nickname":"<3-16>", "code":"<single-use>" }
```
Response: `{ "accountId":"<website user id>" }` (422 on invalid/expired/used/hijack/relink conflict)

Rules: website issues code to authenticated, active, email-verified user (`POST /api/user/minecraft/link-code`, CSRF + same-origin guarded, 15 min TTL, SHA-256 stored). Code is single-use/atomic. Binds `MinecraftIdentity` (namespace `java`, subject=UUID). Prevents duplicate UUID↔account and unauthorized relink/hijack. Backfills active entitlements and queues VIP snapshot after link.

### `GET /v1/bridge/pending`
Response:
```json
{ "deliveries":[{ "deliveryId":"vip_<accountId>_<seq>", "accountId":"...", "playerUuid":"...", "kind":"VIP", "action":"ACTIVATE|REMOVE", "vip":"swift|eclipse|cosmic|overdrive|null", "cashAmount":0, "expiresAt":"2026-12-08T13:00:00Z|null", "sequence":123 }] }
```
Only `PENDING` VIP deliveries for currently linked account↔UUID are returned, ordered by `accountId, sequence` (max 200). `ACTIVATE` includes absolute `expiresAt`; `REMOVE` is final-state removal snapshot (refund/expiration/no active VIP). Pending VIP snapshots are superseded so only the latest final state remains pending.

### `POST /v1/bridge/ack`
Request:
```json
{ "serverId":"swift-survival", "deliveryId":"vip_...","status":"completed","sequence":123 }
```
Response: `{ "ok": true }` (idempotent; duplicate ACK of same delivery/sequence returns success). ACK only moves `PENDING -> ACKED`; it never creates grants, extends VIP, or restores revoked ranks.

### `GET|POST /v1/bridge/status` (operational)
Authenticated bridge request. Query/body `accountId` or `playerUuid`. Returns link + current effective VIP snapshot from active, non-expired, non-revoked entitlements.

## VIP entitlement flow
1. Verified Stripe webhook (existing `/api/webhooks/stripe`, signature + server-side Stripe reconciliation + serialized DB transaction/idempotent `PaymentEvent`) marks order `PAID`.
2. For VIP ranks only (`swift,eclipse,cosmic,overdrive`) and orders linked to a website user, the site creates/reuses `Fulfillment` and creates `VipEntitlement` (unique per order/fulfillment) with **absolute** `expiresAt = paid verification time + 30 days`.
3. If Minecraft identity is linked, a durable `BridgeDelivery` VIP snapshot is queued with a monotonic per-account `sequence`. If not linked, entitlement exists authoritatively and snapshot is queued on `/link`.
4. `charge.refunded` (verified Stripe object) revokes active entitlements for the order and queues a final VIP snapshot (`REMOVE` unless another active entitlement remains).
5. Expired entitlements are treated as inactive by status queries/snapshots; deliveries carry absolute `expiresAt` so LuckPerms temporary group expiry remains correct after restart/reconnect.
6. Cash is **disabled** (no Cash deliveries/credits).

## Minecraft plugin compatibility / changes
Source of truth: `minecraft/SwiftMCBridge-0.2.0/` in this repository (built with real Paper/LuckPerms dependencies per its `BUILD.md`; **not homologated on a live server**, so not production-ready).
- Compatible without protocol changes: `/v1/bridge/link`, `/v1/bridge/pending`, `/v1/bridge/ack`, headers, payload fields, LuckPerms absolute-expiry application, durable local journal/sequence/idempotent SwiftCash operation key pattern.
- Source change made for website compatibility: `minecraft/SwiftMCBridge-0.2.0/src/main/java/br/com/swiftmc/bridge/Backend.java` treats `409` on `acknowledge` as duplicate success (idempotent retry/restart safety).
- The plugin build needs a reviewed local `libs/SwiftCash-0.2.0.jar` (not committed; see `BUILD.md` provenance notes). Rebuild against official Paper 1.21.11, LuckPerms 5.x, Gson/Paper deps and SwiftCash 0.2.0 before deployment.

## Plugin configuration (`plugins/SwiftMCBridge/config.yml`)
```yaml
enabled: true
apiUrl: "https://staging.swiftmc.com.br"
apiKey: "<MINECRAFT_BRIDGE_SECRET>"   # >=32 chars; keep out of source control and chat logs
serverId: "swift-staging"             # MUST match staging MINECRAFT_BRIDGE_SERVER_ID
endpoints:
  link: "/v1/bridge/link"
  pending: "/v1/bridge/pending"
  acknowledge: "/v1/bridge/ack"
pollSeconds: 30
httpTimeoutSeconds: 12
maxBackoffSeconds: 600
```
Do **not** put Stripe keys, DB URLs, or `pk_live` in plugin config. Keep HTTPS only.

## Website environment / Cloudflare bindings
Secrets/runtime: `MINECRAFT_BRIDGE_SECRET`, existing Stripe/DB bindings. Non-secret/config: `MINECRAFT_BRIDGE_SERVER_ID`, optional `MINECRAFT_BRIDGE_ALLOWED_SERVER_IDS` (comma-separated). Migration: `prisma/migrations/20261108203314_minecraft_bridge_vip_deliveries/migration.sql`.

For an offline-mode/cracked Paper server, ensure authentication (e.g., an audited login plugin or correctly configured proxy authentication) is enforced *before* `/link` can execute. Never allow an unauthenticated player to claim another player's offline-mode UUID.

## Paper 1.21.11 validation steps (manual)
1. Apply migration to staging/test PostgreSQL; deploy Worker/site with bridge secrets; keep live payments inactive.
2. Install LuckPerms + SwiftCash 0.2.0 (if present) + rebuilt SwiftMCBridge on Paper 1.21.11/Java 21. Confirm groups `swift,eclipse,cosmic,overdrive` exist in LuckPerms.
3. Create verified website user, generate link code, run `/link <code>` in-game; verify `MinecraftIdentity` binding and `/swiftbridge status`.
4. Create a **test-mode** Stripe payment for a VIP product/order linked to that user; verify webhook marks order paid, entitlement + delivery created, plugin polls and applies LuckPerms temp group with correct absolute expiry.
5. Test offline: pay/link in either order; after reconnect/poll, VIP state arrives once with stable delivery/sequence.
6. Test duplicates/restarts: replay webhook event (Stripe CLI) and restart Paper/API; no duplicate extension/reward; ACK remains idempotent.
7. Test refund: issue Stripe test refund; entitlement revoked, pending final snapshot becomes `REMOVE` (or lower active VIP if business rules later add stacking); LuckPerms reflects final state after poll.
8. Review `/v1/site` operational needs only if added later; current implementation has no separate review queue—refunds revoke authoritative entitlements.
