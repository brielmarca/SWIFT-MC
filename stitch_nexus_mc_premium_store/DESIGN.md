---
name: Strike Nexus
colors:
  surface: '#121318'
  surface-dim: '#121318'
  surface-bright: '#38393f'
  surface-container-lowest: '#0d0e13'
  surface-container-low: '#1a1b21'
  surface-container: '#1e1f25'
  surface-container-high: '#292a2f'
  surface-container-highest: '#34343a'
  on-surface: '#e3e1e9'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#e3e1e9'
  inverse-on-surface: '#2f3036'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#d2bbff'
  on-secondary: '#3f008e'
  secondary-container: '#6001d1'
  on-secondary-container: '#c9aeff'
  tertiary: '#ddb8ff'
  on-tertiary: '#490081'
  tertiary-container: '#b175ec'
  on-tertiary-container: '#400071'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d2bbff'
  on-secondary-fixed: '#25005a'
  on-secondary-fixed-variant: '#5a00c6'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#ddb8ff'
  on-tertiary-fixed: '#2c0051'
  on-tertiary-fixed-variant: '#62259b'
  background: '#121318'
  on-background: '#e3e1e9'
  surface-variant: '#34343a'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an elite, tournament-tier visual atmosphere tailored for competitive gaming, matchmaking networks, and web3/VIP rank storefronts. Moving deliberately away from blocky, skeuomorphic, or juvenile voxel aesthetics, the interface is inspired by high-end esports dashboards and modern tech SaaS. 

The aesthetic marries deep obsidian void environments with faceted crystalline violet light directly sampled from the brand mark. Visual tension is achieved through ultra-dark multi-layered backdrops punctuated by razor-sharp 1px ultraviolet boundaries, subtle radial glassmorphism, and neon violet glows. 

The tone communicates prestige, speed, tactical precision, and high-stakes competition. Players interact with an interface that feels like a next-generation command center: dark, immersive, high-contrast, and impeccably engineered.

## Colors

The palette is anchored in cosmic abyss tones and hyper-charged violet spectrums:

- **Void Obsidian (Neutral Core):** `#090A0F` forms the deepest canvas layer. Container surfaces layer upward through `#0E0F17` (surface-base) and `#13141F` (surface-card) to `#1C1D2D` (surface-hover).
- **Electric Violet (Primary):** `#A855F7` provides vibrant focus for primary actions, rank emblems, and active status indicators.
- **Deep Nexus Purple (Secondary):** `#7C3AED` drives directional gradients, interactive states, and deep bevel depth.
- **Ultraviolet Specular (Tertiary):** `#C084FC` acts as high-energy rim highlights, badge borders, and luminous glow accents.
- **High-Readability Typographic Grays:** Pure crisp white `#F8FAFC` for high-impact headlines and metrics; muted cold slate `#94A3B8` for secondary labels, stats, and metadata; `#475569` for subtle structural dividers.

Gradients flow at 135-degree angles, blending `#C084FC` through `#A855F7` into `#7C3AED` to emulate the crystalline refraction of the brand mark.

## Typography

Plus Jakarta Sans brings architectural clarity, modern geometric curves, and crisp screen legibility across all UI elements. 

- **Display & Headlines:** Heavy weights (700/800) with tight negative tracking (`-0.02em` to `-0.03em`) evoke competitive confidence.
- **Labels & Micro-copy:** Uppercase badge tags and leaderboard column headers utilize `label-md` and `label-sm` with expanded tracking (`0.06em` to `0.08em`) to enforce hierarchy and esports telemetry styling.
- **Body & Data Metrics:** Neutral weights (400) ensure frictionless readability across multi-column tier perks, server rules, and transaction receipts. Numeric values within competitive leaderboards and store prices apply tabular lining figures (`font-variant-numeric: tabular-nums`).

## Layout & Spacing

The layout is built upon a responsive 12-column fluid grid system on desktop (`> 1024px`), transforming to an 8-column layout on tablet (`768px - 1023px`), and a 4-column stack on mobile (`< 768px`).

- Outer section padding scales from `1rem` on mobile up to `2rem` on wide displays, with a maximum layout constrain of `1440px` for optimal viewing distance on ultra-wide gaming monitors.
- Component spacing strictly enforces multiples of 4px/8px to maintain consistent vertical rhythm across product catalogs, server stat modules, and checkout flows.
- Store tiers and VIP tier lists utilize auto-fit CSS grids with consistent `1.5rem` gaps, collapsing gracefully to swipeable horizontal carousels or single-column stacks on smaller screens.

## Elevation & Depth

Visual hierarchy uses a refined dark glassmorphism stack paired with calibrated purple rim illumination:

1. **Canvas (Level 0):** Pure dark abyss `#090A0F` paired with subtle, deep atmospheric purple radial light washes (`radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.08), transparent 70%)`).
2. **Base Containers (Level 1):** `#0E0F17` at 80% opacity with `backdrop-filter: blur(12px)`. Enclosed by a 1px border colored `rgba(255, 255, 255, 0.06)`.
3. **Interactive Cards & VIP Tiles (Level 2):** `#13141F` at 90% opacity with `backdrop-filter: blur(16px)`. Bordered by a 1px dual gradient rim: `rgba(168, 85, 247, 0.25)` blending into `rgba(255, 255, 255, 0.04)`. Ambient drop shadow: `0 8px 32px -4px rgba(0, 0, 0, 0.6)`.
4. **Hero & Selected Items (Level 3):** Solid `#181A29` with interactive state shadows: `0 0 24px -2px rgba(168, 85, 247, 0.35)` and an interior top-edge specular highlight (`inset 0 1px 1px 0 rgba(192, 132, 252, 0.4)`).
5. **Overlays & Modals (Level 4):** `#0E0F17` at 96% opacity with `backdrop-filter: blur(24px)`, framed by an intense neon border `rgba(168, 85, 247, 0.4)` and deep multi-stage drop shadows.

## Shapes

The design system adopts a smoothed, modern rounded silhouette (Level 2) that offsets the sharp, faceted edges of the brand icon:

- Standard controls, inputs, and chips use `0.5rem` (`rounded-md`).
- Primary cards, VIP packages, and server cards utilize `1rem` (`rounded-xl`).
- Feature banners, hero containers, and modals employ `1.5rem` (`rounded-2xl`).
- Emblems, round status indicators, and micro avatar frames utilize circular masks (`rounded-full`).

Diagonal geometry from the brand mark is subtly woven in via optional 45-degree corner accents, faceted progress bar fills, and directional linear gradient angles.

## Components

### Buttons
- **Primary (Electric CTA):** Linear gradient background `linear-gradient(135deg, #C084FC 0%, #A855F7 50%, #7C3AED 100%)`. White text (`#FFFFFF`), bold weight. Subtle top inset specular line `inset 0 1px 0 rgba(255,255,255,0.3)`. Hover state: bloom glow `0 0 20px rgba(168, 85, 247, 0.5)`. Active: scale 0.98.
- **Secondary (Ghost Glass):** Surface `#13141F` with 1px border `rgba(168, 85, 247, 0.3)`. Text `#F8FAFC`. Hover state: border color accelerates to `#A855F7`, background shifts to `#1C1D2D`.

### Cards & VIP Store Tiles
- Engineered with dark glass (`#13141F` at 90% opacity, 16px backdrop blur).
- Outer border: 1px `rgba(168, 85, 247, 0.15)`.
- Featured/VIP Rank cards include a top-mounted illuminated rank chip and a continuous ambient inner glow `inset 0 0 20px rgba(168, 85, 247, 0.05)`.
- Hover transition triggers border brightening to `#A855F7` and a soft upward 4px translation.

### Chips & Badges
- Pill-shaped status indicators with uppercase `label-sm` tracking.
- Rank indicators (e.g., NEXUS, VIP, MVP) feature saturated purple gradient backgrounds with high-contrast white text.
- Live telemetry chips (e.g., "ONLINE: 4,821") feature dark translucent backdrops with a pulsing `#A855F7` dot.

### Form Inputs & Search Fields
- Inset dark wells (`#0A0B12`) with 1px border `rgba(255, 255, 255, 0.08)`.
- Text `#F8FAFC`, placeholder `#64748B`.
- Focus state: border transitions directly to `#A855F7` accompanied by an exterior ring shadow `0 0 0 3px rgba(168, 85, 247, 0.2)`.

### Checkboxes & Radios
- Square rounded (`6px` radius) or circular base with `#0E0F17` surface.
- Unchecked: 1px border `rgba(255, 255, 255, 0.2)`.
- Checked: `#A855F7` background with crisp white icon check/dot and an ambient purple shadow.

### Server Status & Leaderboard Lists
- Striped alternating row backgrounds using transparent and `rgba(255, 255, 255, 0.02)`.
- Rank numbers (1st, 2nd, 3rd) styled with metallic and ultraviolet gradient typography.
- Divider lines use subtle 1px gradients that fade out towards the container edges.