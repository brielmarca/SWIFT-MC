# Site configuration

Copy the site variables from `.env.example` into the deployment environment:

- `MINECRAFT_HOST`: Java Minecraft hostname or IP, without a scheme or port. Default: `play.swiftmc.net`.
- `MINECRAFT_PORT`: Java TCP status port, default `25565`. Set the actual port explicitly (DNS SRV discovery is not performed).
- `MINECRAFT_PUBLIC_ADDRESS`: optional player-facing address, including a non-default port where needed. Defaults to the host and port above.
- `NEXT_PUBLIC_DISCORD_URL`: HTTPS Discord invite (`discord.gg` or `discord.com`). Missing or invalid values show “Discord em breve”. Rebuild after changing this public variable.

`GET /api/server-status` queries the configured Java server directly using Server List Ping. It accepts no user-supplied destination. The deployment must support Node.js outbound TCP to the configured host/port. Bedrock-only UDP servers are not supported by this Java status query.

The query has a 3-second overall timeout and a bounded response size. Results (including offline responses) are cached for 15 seconds; concurrent requests share a pending query. The UI refreshes every 30 seconds and has a 6-second request deadline. Unreachable, timed-out or malformed server responses yield `online: false`, null counts/version and the configured public address. A failed HTTP request is displayed as unavailable. Player counts of zero still represent an online server.

The homepage uses fixed-height status and metrics slots during loading/offline states. Copy IP uses the public address even when the server is offline, with success or manual-copy feedback.

## Verification

- `npm test`: database-free tests, including local TCP fixtures for Minecraft status.
- `npm run test:db`: existing PostgreSQL integration tests. Requires the configured database to be running with migrations applied.
- `npm run lint`
- `npm run build`

Payment-return UI is informational while payments are paused. It does not read payment cookies or poll order endpoints. Existing payment backend code and tests are retained.

## Cart checkout preview

`/checkout` reviews the current local cart, supports item removal, and provides player-details and review steps. “Comprar agora” adds the selected rank without removing other items and navigates here. Empty carts cannot proceed. The final action remains disabled (“Concluir compra — em breve”). Legacy `/checkout/[slug]` URLs return to rank details rather than rendering the old payment form.

Username and email remain in React context across client-side navigation and checkout steps. They are not persisted to browser storage, and a full reload clears them. Rank slugs remain in localStorage; blocked storage falls back to memory for the current session. All prices continue to come from `data/ranks.ts`.

The explicit profile lookup calls `/api/minecraft/profile?username=...` with only the Java username (3–16 ASCII letters, digits, or underscores). The server queries Mojang's profile API with a 4-second deadline and a 16 KiB response bound. Only canonical username, UUID, and a same-origin avatar path are returned. Found profiles cache for 5 minutes; not-found/unavailable results cache for 30 seconds. Cache size and concurrent upstream lookups are bounded.

Heads are fetched server-side from Crafatar via `/api/minecraft/avatar/[uuid]`, with UUID validation, a 4-second deadline, PNG validation and a 64 KiB limit. Images cache for an hour. Avatar failure shows a fixed-size fallback. No third-party profile or avatar request is made directly from the browser, and no email/cart data is sent to either service. Neither endpoint proves account ownership or performs authentication.

## Public players

`/player` validates Java names and links to `/player/[username]`. Up to eight recent searches are stored under `swift-mc-recent-players` in localStorage, deduplicated case-insensitively and validated when read. Users can clear the history; search still works if storage is blocked.

Public profile pages reuse the existing cached server-only lookup. Successful lookups redirect to canonical username casing. Missing/renamed names explain how to search the current name; no rename history is inferred or stored. Unavailable lookups have a retry action, subject to the existing 30-second negative cache. UUID and canonical profile URLs have copy actions with manual-copy fallback.

The existing avatar endpoint also accepts `?view=body`, selecting a fixed Crafatar body-render URL with the same timeout, size bound, image validation, and cache. A failed render falls back to the player head and an unavailable message. No arbitrary provider URLs are accepted. Public profiles do not establish SWIFT MC membership; rank, coins, playtime, first join, last seen, kills, and deaths are all explicitly unavailable until a real server-stats source exists.

## News, events and announcements

Content is typed and local: `data/content/news.ts`, `data/content/events.ts` and `data/content/announcement.ts`. There is no database or CMS. Slugs are stable and URL-safe, never reused after publishing; images must be local assets from `public/`. The samples shipped for preview are marked in the source for replacement.

- `/news` lists only visible posts (`status: "published"` and `publishedAt` in the past), newest first. Search matches title, excerpt, category and tags with accent-insensitive partial words; category and tag chips combine with search. The featured hero appears only while no filter is active. At most six posts are shown per page, with previous/next paging and honest empty/no-result states.
- `/news/[slug]` renders category, publication date, tags, hero image and article blocks (paragraph, heading, list), followed by up to three related posts preferring the same category, then shared tags. Unknown and draft slugs return 404. Each article emits its own title and description metadata.
- `/events` classifies at request time: upcoming (start in the future, soonest first) and past (already started, most recent first); drafts are excluded. No countdown timers are rendered. Dates and times use Horário de Brasília (`America/Sao_Paulo`) through the single formatter in `lib/content-format.ts`.
- The homepage "Novidades" section shows the three latest published posts and links to `/news`. Header and footer navigation include "Novidades" and "Eventos".
- The optional site-wide announcement (a single object or `null`) can define a start/expiry window; outside it nothing renders. It appears above the main content, is announced to assistive technology, and can be dismissed. Dismissing stores `1` under `swift-mc-announcement:<id>` in localStorage and syncs the change across tabs; when storage is blocked the banner still hides for the current visit.
- These routes render dynamically so post visibility, event classification and the announcement window always reflect the current date and time.

## Global site search

The navbar search button (desktop icon and the first mobile menu row) opens a command palette instead of jumping to the store. Shortcuts: `Ctrl+K` / `Cmd+K` anywhere, `/` when focus is not inside an input, textarea, select or editable region, and `Escape` closes the palette. Shortcuts are suspended while the palette or the cart drawer is open.

Search runs entirely client-side on each keystroke against the existing typed sources — `data/content` (published news and visible events only, via the same query functions used by the pages), `data/player-guides` (rules and FAQ), `data/server-info` player links plus the store entry, and Java username validation from `lib/minecraft-profile`. No content is duplicated, no network request is made, and a valid Java username (3–16 letters, digits or underscore) offers `Buscar jogador: <name>` linking to `/player/<name>` without querying Mojang.

Results are grouped (Jogador, Notícias, Eventos, Regras, FAQ, Páginas), capped per group (1/4/3/4/4/5), ranked by title-then-body relevance, and shown with accent-insensitive highlighting and compact snippets. Rules and FAQ results deep-link to their anchors (`/rules#R01`, `/faq#versao`); event results link to `/events`. The empty state explains the query, hints at the player-name format when relevant, and offers quick links.

The dialog uses `role="dialog"` with `aria-modal`, a combobox/listbox result structure with `aria-activedescendant`, a focus trap, focus restoration to the trigger, wrap-around arrow navigation, Enter to open, and a live result-count region. Up to eight recent searches are stored locally under `swift-mc-recent-searches` (deduplicated, cleared from the palette) with no analytics or server persistence; storage failures degrade gracefully.

The store keeps its own product filter at `/store#store-search`; the cart drawer and store links to it are unchanged.

## Wiki / guides

`/wiki` lists published guides from the typed local source in `data/wiki/` (`types.ts` for the schema, `guides.ts` for the replaceable sample content, `index.ts` for queries). No database, CMS or admin panel. The listing offers accent-insensitive search, category filters over the seven canonical categories (with counts, including empty categories), a featured row for guides marked `featured`, responsive guide cards and distinct empty states.

`/wiki/[slug]` renders the guide with a back link, category badge, tags, a sticky "Nesta página" table of contents (chip row on mobile), anchored sections (`scroll-mt` for the sticky header), related guides (explicit `related` slugs first, then same-category fill-ups), previous/next navigation within the category when neighbours exist, and a proper 404 for unknown or draft slugs. Guides are statically generated (`generateStaticParams`) with per-guide metadata.

Content blocks: paragraphs, bullet lists, numbered steps, copyable command blocks (never executed; one-click copy with toast and live-region feedback, honest failure message), info/warning callouts, small tables (row/column consistency is validated by tests) and internal link cards (hrefs must start with `/`). Guides marked `status: "draft"` are hidden from the listing, search, related, adjacency and detail routes.

Global search gained a "Wiki" group (limit 4) fed by `getGuideSearchText`, reusing the existing ranking/highlight pipeline. Navigation includes "Wiki" in the header and footer (shared `playerLinks`); `/play` links to the entry guide and `/faq` links to two guides plus the hub.

## Discord community invite

Discord is used only as an external community and support destination. Set `NEXT_PUBLIC_DISCORD_URL="https://discord.gg/Bupp8tWvpu"` in the build environment (also documented in `.env.example`). Rebuild after changing this public environment variable.

All community/support CTAs use `components/discord-link.tsx`, including the homepage community banner, footer, Play, FAQ, Status, event cards and checkout preview. The shared component opens the configured invite with `target="_blank"` and `rel="noopener noreferrer"`; the unavailable fallback is not rendered when the invite is configured.

The site has no login or account area. Store browsing, the local cart, public player lookups, Minecraft data, wiki and content pages are available without authentication.
