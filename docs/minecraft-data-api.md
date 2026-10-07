# Minecraft Data API contract

The website consumes public server-player statistics from a private HTTP API implemented by the future Minecraft plugin/backend. This document is the interface the Minecraft side must implement. The website does not run the plugin, store player statistics, or accept credentials from the browser.

## Configuration

| Variable | Server-only | Purpose |
|---|---|---|
| `MINECRAFT_DATA_API_URL` | Yes | Base HTTPS URL, e.g. `https://minecraft-data.example.com/v1/`. Blank disables the integration and produces the public unavailable state. |
| `MINECRAFT_DATA_API_TOKEN` | Yes | Opaque bearer token. Set only in the server environment (never `NEXT_PUBLIC_*`). |

Both values are required. The URL must be `https:` (plain `http:` is accepted only for localhost outside production), must not contain credentials, query, or fragment, and is normalized to end in `/`. The token must be non-empty printable ASCII and at most 4096 characters. Missing/invalid configuration is treated as disabled without calling either the private API or Mojang.

## Request

```http
GET /v1/players/{uuid}/stats
Authorization: Bearer <MINECRAFT_DATA_API_TOKEN>
Accept: application/json
```

- `{uuid}` is the canonical dashed lowercase UUID (validated by the website).
- The website only builds this path from validated segments (`players`, the UUID, `stats`). No browser-supplied URL is forwarded.
- Timeouts are 4 seconds; the JSON body is bounded to 16 KiB.
- Redirects are rejected.
- Responses are cached server-side for **15 seconds** (including not-found/unavailable results); concurrent requests are coalesced.

### Status codes

| Status | Website behavior |
|---|---|
| `200` + JSON | Validate and publish normalized data. |
| `404` / `204` | Public `not_found` (player has no server data). |
| `401` / `403` / `429` / `5xx` / timeout / malformed JSON | Public `unavailable` (generic; upstream detail is never exposed). |
| `200` + non-JSON | Treated as unavailable. |

## Response schema (`200`)

```json
{
  "username": "Steve",
  "uuid": "01234567-89ab-cdef-0123-456789abcdef",
  "rank": "VIP",
  "coins": 1500.5,
  "playtimeSeconds": 3661,
  "firstJoin": "2024-01-01T00:00:00Z",
  "lastSeen": "2025-06-01T12:00:00Z",
  "online": true,
  "kills": 12,
  "deaths": 3
}
```

| Field | Type | Rules |
|---|---|---|
| `username` | string | Java username (3–16 chars, `[A-Za-z0-9_]`), case-insensitively equal to the requested identity. |
| `uuid` | string | Dashed lowercase UUID, exactly equal to the requested UUID. |
| `rank` | string \| null | 1–64 printable chars, no control characters; `null` when not ranked. |
| `coins` | number \| null | Finite, ≥ 0, ≤ `Number.MAX_SAFE_INTEGER`; `null` when unknown. |
| `playtimeSeconds` | integer \| null | ≥ 0; `null` when unknown. |
| `firstJoin` / `lastSeen` | ISO-8601 offset datetime \| null | RFC 3339 with `Z` or offset; `firstJoin ≤ lastSeen` when both present. |
| `online` | boolean \| null | `null` when presence is unknown. |
| `kills` / `deaths` | integer \| null | ≥ 0; `null` when unknown. |

Unknown values **must** be explicit `null`. Omitting a field, sending a string where a number is expected, negatives, non-integers for counters, invalid dates, or a `firstJoin` after `lastSeen` causes the whole payload to be rejected as unavailable. Extra fields are accepted but stripped by the website and never rendered. The website never fabricates defaults.

## Example implementation (pseudo-code)

```
on GET /v1/players/:uuid/stats:
  require Authorization == "Bearer " + DATA_API_TOKEN else 401
  validate uuid format else 400
  player = database.find_by_uuid(uuid)
  if not player: return 404
  return 200 JSON {
    username, uuid, rank: player.rank ?? null,
    coins: number_or_null(player.coins),
    playtime_seconds: max(0, player.playtime_seconds),
    first_join, last_seen, online, kills, deaths
  }
```

Content type must be `application/json`. Do not include secrets, internal IDs, moderation notes, IP addresses, emails, or provider diagnostics in the payload.

## Leaderboard request

```http
GET /v1/leaderboards/{category}?limit={1..50}
Authorization: Bearer <MINECRAFT_DATA_API_TOKEN>
Accept: application/json
```

- `{category}` is one of `playtime`, `kills`, `coins`.
- `limit` is required by the website (1–50; the UI requests 10). It must never exceed 50.
- Same transport rules as player stats: 4-second timeout, 16 KiB JSON bound, redirects rejected, results cached **15 seconds** server-side, concurrent requests coalesced.
- The query string is built by the website from validated values only.

### Leaderboard response schema (`200`)

A JSON **array** of entries, ranked by `value` descending:

```json
[
  { "username": "Steve", "uuid": "01234567-89ab-cdef-0123-456789abcdef", "rank": "MVP", "value": 900 },
  { "username": "Alex", "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rank": null, "value": 500 }
]
```

| Field | Type | Rules |
|---|---|---|
| `username` | string | Java username (3–16 chars, `[A-Za-z0-9_]`). |
| `uuid` | string | Dashed lowercase UUID; unique within the payload. |
| `rank` | string \| null | Same rules as player stats; `null` when not ranked. |
| `value` | number | Finite, ≥ 0, ≤ `Number.MAX_SAFE_INTEGER`. **Integer** for `playtime` (seconds) and `kills`; fractional allowed only for `coins`. |

Provider requirements:

- Return at most `{limit}` entries (the website additionally rejects payloads over 200 entries and always truncates to the requested limit).
- Entries must be sorted **descending** by `value`; ties are allowed.
- Never repeat a UUID.
- Return `[]` (not `404`) for a category with no players — the website shows an honest empty state.
- `404`/`204` means the board path is missing, which the website reports as **unavailable**, not empty.
- Any invalid entry, wrong ordering, duplicate UUID, or non-integer `value` on `playtime`/`kills` causes the whole payload to be rejected as unavailable.

## Online players request

```http
GET /v1/players/online
Authorization: Bearer <MINECRAFT_DATA_API_TOKEN>
Accept: application/json
```

- No query parameters: the safe maximum is applied by the website (see below).
- Same transport rules as player stats: 4-second timeout, 16 KiB JSON bound, redirects rejected, results cached **10 seconds** server-side, concurrent requests coalesced.

### Online players response schema (`200`)

A JSON **array** of currently connected players (any order):

```json
[
  { "username": "Steve", "uuid": "01234567-89ab-cdef-0123-456789abcdef", "rank": "VIP", "playtimeSeconds": 3661 },
  { "username": "Alex", "uuid": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "rank": null, "playtimeSeconds": null }
]
```

| Field | Type | Rules |
|---|---|---|
| `username` | string | Java username (3–16 chars, `[A-Za-z0-9_]`). |
| `uuid` | string | Dashed lowercase UUID; unique within the payload. |
| `rank` | string \| null | Same rules as player stats; `null` when not ranked. |
| `playtimeSeconds` | integer \| null | ≥ 0 seconds; `null` when the provider does not track it. |

Provider requirements:

- **`[]` means exactly 0 players online** and is a valid success response — the website renders an honest empty state.
- Return at most 100 entries (the website rejects payloads over 200 entries and truncates anything larger to 100, keeping the body inside the 16 KiB bound).
- Never repeat a UUID; a player can only be online once.
- `404`/`204` means the path is missing, which the website reports as **unavailable**, not as 0 players.
- Any invalid entry, duplicate UUID, or non-integer `playtimeSeconds` causes the whole payload to be rejected as unavailable.

## Public website endpoints

The website re-exposes only the normalized schema:

```http
GET /api/player/{username}/stats
GET /api/leaderboards?category={playtime|kills|coins}&limit={1..50}
GET /api/players/online
```

Player stats:

- `200`: `{ "status": "available", "data": { ...normalized fields... } }`
- `404`: `{ "status": "not_found" }`
- `400`: `{ "status": "invalid" }` (bad Java username)
- `503`: `{ "status": "unavailable" }`

Leaderboards:

- `200`: `{ "status": "available", "data": { "category": "...", "entries": [ ...normalized entries... ] } }`
- `400`: `{ "status": "invalid" }` (unknown category or limit outside 1–50)
- `503`: `{ "status": "unavailable" }`

Online players:

- `200`: `{ "status": "available", "data": [ ...normalized entries... ] }` (empty array = 0 online)
- `503`: `{ "status": "unavailable" }` (missing configuration, timeout, or invalid payload)

No token, raw provider response, stack trace, or configuration value is included. The browser never receives `MINECRAFT_DATA_API_TOKEN`.

## Reuse for future features

- `fetchMinecraftData(config, segments, fetcher, timeoutMs, query)` is a generic authenticated JSON transport with timeout, 16 KiB bound, redirect rejection, validated query strings, and safe error normalization.
- `getMinecraftDataConfig()` centralizes configuration validation.
- `playerStatsSchema` / `PlayerStats`, `leaderboardEntrySchema` / `LeaderboardEntry`, and `onlinePlayerSchema` / `OnlinePlayer` are the shared normalized shapes; each service adds its own validation, ordering/uniqueness checks, and short caching (10–15 seconds).
- `formatPlaytime`, `formatPlayerTimestamp`, and `formatPlayerNumber` are reusable presentation helpers.

New read-only boards (e.g. deaths, win streaks) only need a new `{category}` accepted by both sides plus the same schema rules — the transport, caching, public endpoint, and UI patterns stay unchanged.
