# StockRight Design System

> Foundation document and asset library for the StockRight design system.
> Source: **StockRight — Brand Language v3** (May 2026)

---

## Company Context

**StockRight** is a mobile-first **warehouse management system for rural and suburban Indian cold-storage operators**. The product is positioned as a "smarter version of the paper register" that operators already trust — warm, readable, unambiguous, and honest about network state.

**Emotional goal:** Users should feel *simple and relieved*, not impressed by technology.

**Audience:** Warehouse operators, mandi accountants, cold-storage owners and their staff in tier-2/tier-3 India. Often busy, on their feet, working in patchy network conditions, and primarily literate in Telugu, Hindi, Tamil, Kannada, or Bengali — English is a fallback, not a default.

**Core flows the product cares about:**
- **Inward** — recording stock arriving at the godown
- **Outward** — recording stock leaving
- **Parties** — managing customers / suppliers
- **Collection** — tracking payments due
- **Lots / Bags / Godowns** — the inventory primitives

The product must work offline and tell the user honestly when it is offline.

---

## Products Represented

1. **StockRight Mobile App** — primary surface. Bottom tab bar + center FAB on phones, collapsible side nav on tablet, persistent 200px side nav on desktop. This is the surface the design system is tuned for.

There is no marketing website, docs site, or admin console in scope yet. This system is a single-product system.

---

## Sources

| Source | Location | Status |
|---|---|---|
| StockRight — Brand Language v3 (May 2026) | Pasted into the chat as the originating brief | ✅ Primary source — referenced throughout |
| Codebase | — | ❌ Not provided |
| Figma | — | ❌ Not provided |
| Logo / brand assets | — | ❌ Not provided — placeholder wordmark generated |
| Slide template | — | ❌ Not provided — no slides created |

> **For future iteration:** if a Figma file, codebase, or finalized logo lock-up exists, attach it via the Import menu. Visual recreations of UI components in `ui_kits/` are derived from the brand doc only and may diverge from the actual product.

---

## Index

Root files:
- `README.md` — this file
- `colors_and_type.css` — all design tokens as CSS custom properties (light + dark), plus base type styles
- `SKILL.md` — agent-skill manifest for using this system in other projects
- `fonts/` — webfont files (Noto Serif, Noto Sans, Noto Sans Mono — loaded from Google Fonts CDN; no local TTFs needed)
- `assets/` — logo placeholders (light + dark wordmark)
- `preview/` — design system preview cards (registered for the Design System tab)
- `preview/explorations/` — alternative designs surfaced for comparison (e.g. dark-mode CTA options)
- `ui_kits/stockright-app/` — high-fidelity mobile UI kit (`index.html` + JSX components)
- `screenshots/` — verification screenshots from the build process

### Desktop data tables (web, `sm` and up)

Register-style **tables are desktop-only** (`sm` breakpoint and above). Narrow viewports use **card lists** with server-backed infinite scroll and prefetch near the end of the list — no table chrome, no footer spinner rows.

- **Sort:** Server sort only, on allowlisted columns; header click toggles direction.
- **Pagination:** Offset paging with rows-per-page control, page indicator, and “Showing X–Y of Z” where **Z** is the filtered total from the server (same filters as the current query). **Money:** while the search box has text, subtle **Loader2** (or equivalent) may appear in the search row during fetches; **SearchX** for no rows.
- **Loading:** Skeleton on first load for the activity region; when loading more on mobile lists, use a **skeleton stub** in the list footer (not a spinner row in the register).
- **Styling:** All colors via CSS tokens from `colors_and_type.css` — no hardcoded hex in table or list code.

Mobile lists repeat the same row facts (title line, reference · date, amount, method, optional type) using shared tokens from `@stockright/shared/tokens`.

### UI kits
| Kit | Surface | Status |
|---|---|---|
| `ui_kits/stockright-app/` | Mobile app — Home / Stock / Parties / Settings / Inward entry | ✅ Click-thru prototype with offline-queue, dark-mode toggle, all atomic components |

### Preview cards
22 cards registered, grouped: **Colors** (5), **Type** (4), **Spacing** (3), **Components** (8), **Brand** (2 — wordmark, voice). Each card targets ≤700px wide and shows tokens or a single concept directly.

---

## Content Fundamentals

The voice is the **experienced mandi accountant** — calm, honest, brief, never condescending, always assuming the user is busy and on their feet. The system actively *avoids* sounding like software.

### Tone
- **Plain, not technical.** Never expose system or transport language to users.
- **Past tense for confirmations.** ("240 bags recorded ✓" — not "Recording…" or "Will record")
- **Specific over generic.** Always include numbers, party names, lot numbers — never "Operation successful."
- **Reassuring under failure.** Errors say what happened and what to do. Never blame the user. Never expose codes.

### Casing
- **Sentence case** for all UI copy: buttons, labels, headings, toasts.
- **UPPERCASE** is reserved for `Label` typography (Noto Sans Mono, 11px, ls 0.1em) — column headers, status tags. Never for sentences.
- **Title Case** is not used.

### Person
- **"You"** for the operator. ("You're offline. Entry saved.")
- **"We"** when the system has done something on the user's behalf. ("We couldn't find that party.")
- Never **"I"** — the product is not anthropomorphized as a single assistant.

### Emoji & Iconography in copy
- **No emoji** in UI strings as decoration.
- **Functional glyphs are allowed** in copy where they carry meaning: `✓` for success, `●` for online, `⚡` for offline-queued, `↑` for syncing.
- All other status/action indication uses Lucide icons rendered as components, never inline characters.

### Numbers & dates
- **Indian number system** always: `₹2,47,500`, `2.5 Lakh`, `1 Crore`. Never `₹247,500`, `250K`, `10M`.
- **Date format** for forms and formal display: `DD/MM/YYYY`.
- **Money activity lists** use compact **`d MMM`** (e.g. `12 Jan`) via `formatMoneyListDate` in `@stockright/shared/utils` — scannable, matches card-list preview density in `preview/components-cards.html`.
- **Bags, lots, parties** — operator vocabulary, never SKU / units / clients / inventory.

### Money KPI (compact, two-up)

Used on the Money tab beside filters: same **KPI** scale as `preview/type-numbers.html` — mono label **11px** uppercase **`letter-spacing: 0.1em`**, value **38px / 700** Noto Serif tabular, subline **13px** body. Teal/rust semantic fills for received/paid totals. Narrow viewports may use one step smaller numerals if two columns clip.

### Searchable transaction list (Money + Stock)

Shared implementation paths:

| Concern | Package / API |
|--------|-----------------|
| Local filter (0ms) | Money: `filterMoneyRowsLocal` in `@stockright/shared/money`. Stock: `applyStockTabClientFilters` / `stockMovementMatchesSearch` in `@stockright/shared/stock-tab` |
| Deduped merge | Money: `mergeUniqueMoneyRows` / `moneyRowKey`. Stock: `mergeUniqueStockRows` / `stockMovementRowKey` |
| Server count + pages | Money: `countMoneyMovements` + `listMoneyMovements`. Stock: `countStockMovements` + `listStockMovements` |
| Debounced value | `useDebouncedValue` in `@stockright/shared/hooks` (400ms Money + Stock feeds) |
| Offline / last list | Money snapshot helpers in `@stockright/shared/offline/app-cache`; Stock KPI + baseline via `readStockTabCache` / `writeStockTabCache` |

**UI:** optional **`searchAccessory`** beside the search field (web `DashboardPageShell`, mobile `TabScreenHeader`) — **Loader2** (or platform spinner) **only** during the background search request; **SearchX** for empty combined results. Clearing the query resets **page 1** and the server window. **Stock on mobile**: near-end sentinel / scroll prefetch plus `mergeUniqueStockRows`; **desktop**: sortable tables with totals + rows-per-page (see *Desktop data tables* above).

### Vibe
Warm. Honest. Quiet competence. The visual register is **paper-shop confidence**: cream paper, dark soil ink, a single warm amber accent for action. The copy mirrors that — short sentences, soft warmth, specific facts, no marketing words.

### Examples (good vs bad)

| ✅ Good | ❌ Bad |
|---|---|
| 240 bags recorded ✓ | Transaction committed successfully |
| Updated | Sync completed |
| We couldn't find that party | Record not found |
| Please log in again | Session expired |
| Something went wrong. Try again. | HTTP 500 — server error |
| You're offline. Entry saved, will upload when connected. | Network request failed |
| No stock yet. Tap + to record your first inward. | No data |

### Forbidden vocabulary in user copy
`SKU`, `ASN`, `BOL`, `WMS`, `ERP`, `sync` (verb in copy — internal only), `commit`, `transaction`, `optimize`, `leverage`, `session`, `HTTP`, `server`, `record`. Use plain replacements (see `Section 7` of the brand doc).

---

## Visual Foundations

### Overall feeling
StockRight looks like a **smarter paper register**. Warm near-white backgrounds (`#FEFCF8`), dark soil text (`#1C1A16`), a single confident amber accent (`#C8712A`) for action. The UI is calm, dense-but-not-cramped, with strong contrast and no decorative noise. There are **no gradients on UI surfaces, no hero illustrations, no glassmorphism, no neon**. The product looks honest.

### Color
- **Light mode is all-warm.** The page is warm near-white, surfaces are pure white for max contrast headroom, and the secondary surface is the original cream (`#F5F0E8`). Inset/recessed surfaces use parchment (`#EDE6D9`).
- **Dark mode is warm-black.** Deep warm black (`#12100B`) page, with surface layers stepping up at ~1.12×, ~1.16×, ~1.18× for OLED separation. Amber shifts brighter (`#E8943A`) and amber CTAs use **soil text, not white** — white-on-amber physically fails WCAG.
- **Brand amber is split into two tokens.** `brand-ui` (`#C8712A`) is for fills/icons/borders only; `brand-text` (`#8C4A12`) is the only legal amber for text. This is non-negotiable.
- **Semantic colors are locked to meaning:** teal (`#0B7B6E`) = inward / arriving / positive. Rust (`#A83422`) = outward / leaving / errors / destructive. Amber (`#7B5200`) = pending / collection due / offline queue. **Never cross these.**

### Typography
- **One family system: Noto.** Noto Serif for display/headings/numbers, Noto Sans for body, Noto Sans Mono for codes/timestamps/labels. They share metrics so mixing is seamless.
- **Why Noto:** native Telugu, Devanagari, Tamil, Kannada, Bengali rendering. Latin-only serifs (Lora, Playfair, Merriweather) are forbidden because they break Indian script rendering.
- **Numbers are Noto Serif Bold** — KPIs and currency values use the display serif at 38px / 700 to feel ledger-like. **Compact list amounts** (Money activity cards / register list) use **28px / 700** for the primary figure — see `preview/components-cards.html`.
- **Labels are Noto Sans Mono UPPERCASE 11px ls 0.1em** — column headers and tags.

### Spacing
4px base grid. Tokens `sp-1` (4) through `sp-16` (64). Card padding is typically `sp-4` (16) or `sp-6` (24). Section gaps are `sp-8` (32) or `sp-16` (64). **Touch target minimum is 48px (`sp-12`)** — this is the floor, not a target.

### Backgrounds
- **No imagery.** No hero photos, no full-bleed photography, no decorative illustrations on UI.
- **No gradients on surfaces.** The only gradient in the system is the skeleton-loader shimmer.
- **Solid warm fills only.** Layering is done with the four bg tokens (`page` → `surface` → `subtle` → `inset`), never blur or transparency.
- **No textures.** The "paper" feeling comes from the warm color, not from a paper image.

### Animation
- **Fast, honest, acknowledge-first.** Every interaction must produce visible feedback in ≤150ms.
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `cubic-bezier(0.4, 0, 1, 1)` for exits.
- **Durations:** 120ms (button press, toggle), 200ms (panel open, card appear), 350ms (page transition). Nothing slower.
- **Haptics:** medium impact on every primary CTA (mobile).
- **Optimistic UI:** inward/outward entries appear immediately and reconcile in the background.
- **No bounces, no spring overshoot, no parallax, no Lottie illustrations.** Motion is always functional.

### Hover states (desktop / tablet)
- Buttons: darker shade (`brand-ui-hover` `#AD5E1F` for primary)
- List items / nav items: `bg-subtle` fill
- Links: `brand-text` underline
- **No opacity changes** — opacity hover is forbidden because it reads as "disabled" to first-time users.

### Press / active states
- Buttons: even darker shade (`brand-ui-press` `#9A5418`)
- Tap feedback: 1.0 → 0.97 scale (mobile only) over 80ms
- List items: `bg-inset` fill
- **No color inversion, no ripples** — too software-y.

### Borders
- **1px `border-default`** is the base for cards, list dividers, top bars
- **1.5px `brand-ui`** for focused inputs
- **1px tinted border** on status surfaces (`inward-border`, `outward-border`, `pending-border`, `brand-border`)
- Borders are always solid. Never dashed, never dotted.

### Shadows
- **Sparingly used.** Cards on `bg-page` typically use a 1px border, not a shadow.
- **Elevation 1** (raised card / FAB resting): `0 1px 2px rgba(28, 26, 22, 0.05), 0 1px 1px rgba(28, 26, 22, 0.03)`
- **Elevation 2** (popover / modal): `0 4px 12px rgba(28, 26, 22, 0.08), 0 2px 4px rgba(28, 26, 22, 0.04)`
- **Elevation 3** (FAB pressed / sheet): `0 8px 24px rgba(28, 26, 22, 0.12), 0 4px 8px rgba(28, 26, 22, 0.06)`
- Shadows in dark mode are deeper-warm-black, not pure black.
- **No inner shadows.** No glow effects.

### Corner radii
- **`radius-sm` 4px** — small chips, inline tags
- **`radius-md` 8px** — buttons, inputs, cards (default)
- **`radius-lg` 12px** — sheets, modals
- **`radius-xl` 16px** — bottom sheets
- **`radius-pill` 9999px** — pill buttons, status badges, FAB
- The default for almost everything is **8px**. The product reads as gently rounded, not soft.

### Cards
- Background: `bg-surface` (white)
- Border: 1px `border-default`
- Radius: `radius-md` (8px)
- Padding: `sp-4` (16px) or `sp-6` (24px)
- **Shadow optional**, only when sitting on a busy surface
- No border-left accent stripes. No colored card variants — semantic intent comes from a status badge inside the card, not from card chrome.

### Transparency & blur
- **Used sparingly.** Reserved for the focus ring on inputs (`rgba(200,113,42,0.12)`, 3px) and the pressed-overlay on tappable list items in dark mode.
- **No backdrop-blur** on top bars, modals, or sheets — surfaces are opaque.

### Layout rules
- **Top bar is chrome, not navigation.** Wordmark + network status + primary CTA only. No tabs in the top bar.
- **One nav system per breakpoint.** Bottom tabs (mobile) OR side nav (tablet/desktop), never both.
- **52px top bar height.**
- **48px touch target floor** for everything tappable.
- **16px input font-size floor** to prevent iOS auto-zoom.
- **Safe-area padding** on bottom tab bar: `calc(8px + env(safe-area-inset-bottom))`.

### Imagery vibe (when imagery is added later)
If the product ever uses imagery, the brief is: warm-toned photography, natural light, real godown / mandi / paddy environments — not stock photography, not staged office shots, not illustrations. Black-and-white is acceptable for archival/historical contexts only. No filters, no grain effects, no duotones.

---

## Iconography

**No icon font is shipped with the product.** The brand doc references the existence of icons (`+` FAB glyph, network status indicators, tab bar icons) but does not specify a set.

**Substitution:** [Lucide](https://lucide.dev) is used as the closest CDN-available match to the StockRight brand register: open, simple, 2px stroke weight, neutral, geometric. Lucide is loaded as a web component from CDN in the UI kit. **This is a substitution to flag** — when the production icon set is decided, replace the Lucide imports.

### Usage rules
- **Tab bar icons:** 24px, stroke 2px, `text-tertiary` inactive / `brand-ui` active.
- **FAB:** 24px `+` glyph, white on `brand-ui`.
- **Inline icons:** 16px or 20px, color matches surrounding text token.
- **Status glyphs in copy** (`✓`, `●`, `⚡`, `↑`) are **Unicode characters**, not icons. They are functional and live inside text strings.
- **No emoji** as iconography.
- **No custom illustrated icons.** The brand is intentionally restrained — single-stroke line icons only.
- **No filled/duotone variants.** Stroke-only.

### Logo / wordmark
The brand doc does not include a logo lock-up. A simple wordmark placeholder ("StockRight" set in Noto Serif 600) is generated and included in `assets/` so the UI kit can display the brand at the expected position. **Replace with real lock-up when available.**
