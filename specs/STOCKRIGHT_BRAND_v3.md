# StockRight — Brand Language v3
> Foundation document for the StockRight design system.  
> Last updated: May 2026

---

## Overview

StockRight is a mobile-first warehouse management system for rural and suburban Indian cold-storage operators. The brand language must feel like a **smarter version of the paper register** operators already trust — warm, readable, unambiguous, and honest about network state.

**Emotional goal:** Users feel *simple and relieved*, not impressed by technology.

---

## 1. Color System

### 1.1 Light Mode Backgrounds

Backgrounds are lightened from the original cream palette to give brand-ui maximum contrast headroom. The old cream and parchment are now used as subtle/inset layers.

| Token | Value | Role |
|---|---|---|
| `bg-page` | `#FEFCF8` | Warm near-white page canvas |
| `bg-surface` | `#FFFFFF` | Cards, inputs — pure white for max contrast |
| `bg-subtle` | `#F5F0E8` | Sidebar, table header (formerly cream) |
| `bg-inset` | `#EDE6D9` | Pressed, recessed states (formerly parchment) |

### 1.2 Text

| Token | Value | Contrast on White | Grade |
|---|---|---|---|
| `text-primary` | `#1C1A16` | 17.37:1 | ✓ AAA |
| `text-secondary` | `#4A4237` | 9.88:1 | ✓ AAA |
| `text-tertiary` | `#7A6F61` | 4.91:1 | Large/decorative only |
| `text-placeholder` | `#C0B8B0` | — | Decorative only |

### 1.3 Brand — Two Token System

> **Amber physics constraint:** The amber hue `#C8712A` has a luminance of 0.2426. No background — including pure white — can achieve 7:1 contrast against it. This is a spectral property of orange-amber, not a design failure. The solution used by Material Design, Atlassian, and others is to split the brand into two tokens based on usage context.

| Token | Value | Contrast | Usage |
|---|---|---|---|
| `brand-ui` | `#C8712A` | 3.59:1 on white | Button bg, icon fill, active indicator, borders — **never body text** |
| `brand-ui-hover` | `#AD5E1F` | — | Hover state |
| `brand-ui-press` | `#9A5418` | — | Active press state |
| `brand-text` | `#8C4A12` | 6.77:1 on white (AA+) | Any text or label using brand color |
| `brand-subtle` | `#F5E8D8` | — | Tint background for pills and tags |
| `brand-border` | `#E0B08A` | — | Tint border |

**Rule:** If it's text → use `brand-text`. If it's a button, icon, or indicator → use `brand-ui`.

### 1.4 Functional States

| Token | Value | On bg contrast | Grade |
|---|---|---|---|
| `inward` | `#0B7B6E` | 4.60:1 | ✓ AA (badge bold text) |
| `inward-bg` | `#E6F5F3` | — | — |
| `inward-border` | `#A8DDD7` | — | — |
| `outward` | `#A83422` | 5.62:1 | ✓ AAA UI |
| `outward-bg` | `#F7EAE7` | — | — |
| `outward-border` | `#E0B8B0` | — | — |
| `pending` | `#7B5200` | 6.16:1 | ✓ AAA UI |
| `pending-bg` | `#FAF2D9` | — | — |
| `pending-border` | `#E0CC88` | — | — |

**Semantic rules — never cross these:**
- `inward` / teal = stock arriving, positive, confirmed
- `outward` / rust = stock leaving, errors, destructive actions
- `pending` / amber = waiting, collection due, offline queue

### 1.5 Dark Mode Tokens

Activate by setting `data-theme="dark"` on `<html>`. Layer stepping is intentionally wider than v2 to ensure surfaces are visually distinct on OLED screens.

| Token | Value | Notes |
|---|---|---|
| `dm-bg-page` | `#12100B` | Deep warm black |
| `dm-bg-surface` | `#1F1C14` | 1.12× page |
| `dm-bg-subtle` | `#2C281C` | 1.16× surface |
| `dm-bg-inset` | `#3A3325` | 1.18× subtle |
| `dm-text-primary` | `#F0EBE0` | 14.31:1 on surface ✓ AAA |
| `dm-text-secondary` | `#C4BAA8` | 8.86:1 on surface ✓ AAA |
| `dm-text-tertiary` | `#8A7F6E` | 4.33:1 — large/decorative only |
| `dm-brand-ui` | `#E8943A` | 7.07:1 as text/icon ✓ AAA |
| `dm-brand-cta-text` | `#1C1A16` | 7.22:1 on dm-brand-ui ✓ AAA — **not white** |
| `dm-inward` | `#34C4AD` | 7.81:1 ✓ AAA |
| `dm-outward` | `#E8705A` | 5.59:1 ✓ AA+ |
| `dm-pending` | `#D4A020` | 6.31:1 ✓ AAA UI |

> **Dark mode CTA note:** White text on amber (`#E8943A`) fails WCAG at any achievable amber luminance. Use `dm-brand-cta-text: #1C1A16` (soil) on amber buttons. This is consistent with Material Design's handling of amber/yellow tokens.

---

## 2. Typography

### 2.1 Font System

One type family system across three roles. Chosen for **full Indian script coverage** without fallback stacking.

| Token | Typeface | Role |
|---|---|---|
| `font-display` | Noto Serif | Headings, large numbers, display |
| `font-body` | Noto Sans | Body copy, UI labels, form text |
| `font-mono` | Noto Sans Mono | Lot numbers, codes, timestamps, column headers |

**Why Noto:** Noto Serif and Noto Sans share identical vertical metrics and x-height, so mixing them never looks mismatched. All three cover Telugu, Devanagari (Hindi), Tamil, Kannada, and Bengali natively. Do not substitute Latin-only serifs (Lora, Playfair Display, Merriweather) — they will break Indian script rendering.

### 2.2 Type Scale

| Name | Size | Weight | Font | Usage |
|---|---|---|---|---|
| Display | 48px | 700 | Noto Serif | Hero, page title |
| H1 | 38px | 600 | Noto Serif | Primary screen heading |
| H2 | 30px | 600 | Noto Serif | Section heading |
| H3 | 24px | 500 | Noto Serif | Card heading |
| Body | 15px | 400 | Noto Sans | Body copy, descriptions |
| Small | 13px | 400 | Noto Sans | Captions, helper text |
| Label | 11px | 500 | Noto Sans Mono | Column headers, tags — UPPERCASE, ls 0.1em |
| Number | 38px | 700 | Noto Serif | KPI values, currency |

### 2.3 i18n Rules

- Default language on first open: detect device locale → Telugu (AP/TG), Hindi (North), Tamil (TN), Kannada (KA). English is the fallback, not the default.
- No hardcoded English strings in UI components. All labels go through i18n keys.
- Date format: `DD/MM/YYYY` always
- Currency format: `₹2,47,500` (Indian system) — never `₹247500` or `₹247.5K`
- Number words: "2.5 Lakh" not "250K", "1 Crore" not "10M"

---

## 3. Components

### 3.1 Touch Targets

| Dimension | Value | Implementation |
|---|---|---|
| Visual height (controls, buttons) | **36px** | CSS: `min-height: var(--touch-target)` with centered content; primary box **36px** tall where spec calls for “visual” height |
| Tap / pointer target | **48px** | `min-height: var(--touch-target)` (48px) on interactive controls — never smaller |
| Spacing between adjacent targets | **≥ 8px** | WCAG 2.2 — use `gap: 8px` / `--adjacent-target-gap` between stacked or horizontal controls |
| Input font | **16px always** | Prevents iOS auto-zoom on focus — never change |

**Mobile (React Native):** mirror with `minHeight: 48` on `Pressable` / rows; keep **≥8px** `gap` between adjacent tabs and footer actions (`DashboardTabBar`, `BottomTabBar`).

### 3.2 Buttons

```
btn-primary   → background: brand-ui, color: white (AA large text)
btn-secondary → background: bg-subtle, color: text-primary
btn-ghost     → background: transparent, border: border-default
btn-danger    → background: outward-bg, color: outward
```

Sizes: all use **48px minimum hit height** (`--touch-target`); visual content centers inside (**36px**-tall text row typical).  
Modifiers: `btn-pill` (border-radius: 9999px), `btn-full` (width: 100%)

### 3.3 Badges / Status Pills

Always use semantic color — never use brand amber for status badges.

```
badge-inward   → inward-bg / inward text
badge-outward  → outward-bg / outward text
badge-pending  → pending-bg / pending text
badge-brand    → brand-subtle / brand-text
badge-neutral  → bg-subtle / text-tertiary
badge-online   → inward-bg / inward text (optional; **not** shown on desktop web when connected)
badge-offline  → pending-bg / pending text (with queued count)
```

### 3.4 Form Inputs

- **Hit height:** follow **§3.1** — minimum **48px** tap row where the control is the primary target; **36px** visual field height for the bordered input box is acceptable when the outer `Pressable`/`minHeight` meets 48px.
- Border: 1.5px `border-default`, 1.5px `brand-ui` on focus + 3px focus ring `rgba(200,113,42,0.12)`
- Font size: **16px — this must never be changed.** Any smaller triggers iOS auto-zoom.
- Placeholder: `text-placeholder` color, 15px font

### 3.5 Button Loading State

**Never use a spinner inside a button.** Instead, change the button label to convey progress.

```tsx
// ✅ Correct — label communicates state
<Button loading={isLoading} loadingLabel="Sending…">Send Code</Button>
<Button loading={isLoading} loadingLabel="Verifying…">Verify Code</Button>
<Button loading={isLoading} loadingLabel="Saving…">Save</Button>

// ❌ Wrong — spinner adds visual noise and doesn't communicate what's happening
<Button loading={isLoading}><Spinner /> Send Code</Button>
```

The `loadingLabel` prop on `Button` replaces children text during the loading state and disables the button automatically. When `loading` is true, the button stays disabled until either the operation fails (caller resets `loading`) or the component unmounts on success. **Mobile (Expo):** use the same `loadingLabel` pattern — no `ActivityIndicator` inside buttons.

### 3.6 Skeleton Loading

Use skeleton screens during all loading states. Never use bare spinners.

```css
background: linear-gradient(90deg, bg-subtle 25%, bg-inset 50%, bg-subtle 75%);
background-size: 200% 100%;
animation: shimmer 1.5s ease-in-out infinite;
```

### 3.7 Offline queue & connectivity (UI)

- **Mobile app & mobile-web:** full-width offline banner when offline (queued count), matching copy tone. No separate “online” pill when connected.
- **Desktop web:** do **not** show an “online” badge when connected. When offline, show queued state **in the side nav** (compact badge under the wordmark) — same semantics as the mobile offline banner.
- **Syncing:** optional “↑ Syncing…” with progress when applicable.

```
Offline → badge-offline: "⚡ N queued" — always show count when shown
```

Do **not** use `badge-online` / “● Online” on desktop web.

---

## 4. Navigation

### 4.1 Canonical Pattern

**One navigation system per breakpoint — never show two simultaneously.**

| Breakpoint | Nav Pattern | Notes |
|---|---|---|
| Mobile `<640px` | Bottom tab bar | No separate top header on mobile-web; per-tab FAB/sheets as designed |
| Tablet `640–1024px` | Collapsible side nav | Icon-only collapsed, expand on tap |
| Desktop `>1024px` | Persistent side nav | 200px wide, always visible |

### 4.2 Bottom Tab Bar (Mobile app & mobile-web)

- Four primary destinations (e.g. Home, Stock, Parties, Money); platform-specific overflow (e.g. profile) as needed.
- **Icons ~20px**, **labels ~11px** (semibold when selected) — compact bar; FAB / sheets for tab actions.
- FAB / primary actions: follow per-tab pattern; not duplicated in a global header on mobile-web.

### 4.3 Side Nav (Desktop web, ≥640px)

- Width: `var(--sidenav-width)` (typically 200px)
- Background: `bg-subtle`
- Border-right: 1px `border-default`
- **Wordmark** at top of the column with comfortable vertical padding — this is the only persistent wordmark on desktop web (no duplicate header bar).
- **Flat list** — no section group headings for a small set of routes (Home, Stock, Parties, Money, Preferences).
- **Selected item:** match **mobile tab bar** — `bg-brand-subtle`, `text-brand-text`, **semibold** (not filled `brand-ui`; that is for primary buttons only).
- **Hover (inactive):** `bg-inset`, `text-primary`
- **Typography:** **14px** nav labels (same weight scale as before density tweaks), **18px** icons, **2px** stroke, compact vertical rhythm (`gap` between items ≈ 2px).
- **Icon stroke:** same weight as bottom tabs (e.g. 2px).
- **Footer (below routes):** **User block** (avatar + full name + warehouse line, no role), then a **1px separator**, then **Log out** as a full-width row with the same **hover** treatment as nav links (`cursor-pointer`, `hover:bg-inset`, `hover:text-primary` on label tone). No avatar popover.

### 4.3a Filter chip rows (Web + mobile app)

- Chips sit **without** a bottom border rule — list/search content scrolls flush so the filter row does not feel “chopped” from the body.

### 4.4 Web page chrome (no legacy TopBar)

**Desktop (≥640px):**

- **`<main>` padding:** `px-6 pb-6 pt-6` (24px gutters + top breathing room).
- Main column uses **page background** (`bg-page`) continuously — no 1px rule separating a “header app bar” from content.
- **Account:** **Home** tab shows initials avatar in the **page title row (top-right)** on all breakpoints; tap opens **Preferences**. **Log out** lives at the **bottom of Preferences** (last action), not in the bottom tab bar. **Side nav footer (desktop):** user summary, separator, Log out — as above.
- **Tab CTAs** belong in the **page title row** (right-aligned), split per tab, each with **`min-width: var(--cta-tab-min-width)`** (equal width, `justify-center`) so pairs align cleanly:
  - Home: none
  - Stock: Add Lot (secondary), Add Delivery (primary)
  - Money: Add Receipt (secondary), Add Payment (primary)
  - Parties: Add Party (primary)

**Mobile-web (`<640px`):**

- **No** separate top header row (no wordmark strip, no duplicate chrome). Bottom tab bar + in-page patterns only.
- **`<main>` padding:** same horizontal gutter as desktop — **`px-6`**. Vertical rhythm: **`pt-4` / `pb-4`** on small viewports, **`sm:pt-6` / `sm:pb-6`** on `≥640px` so content is not flush to the viewport after removing the old app header.

### 4.5 Preferences (`/settings`)

- **Label:** “Preferences” (not “Profile & settings”) in nav and page title.
- **Back control:** show **only** on mobile app and mobile-web (`<640px`). **Desktop web:** no back affordance — users navigate via SideNav.
- **Log out:** last primary action on the page (dedicated row / section), not in the global tab bar.

---

## 5. Motion & Animation

### 5.1 Principles

Every action must produce immediate, visible feedback. Our users come from a paper-based world — silent operations feel broken.

| Principle | Implementation |
|---|---|
| Response time | ≤150ms for visual acknowledgment |
| Acknowledge-first | Show success state optimistically, roll back on error |
| Haptics | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on every primary CTA |
| Offline queue | Show count when offline (banner or badge); update as entries queue |
| Skeleton screens | All content areas show skeleton during loading — no spinners |
| Optimistic UI | Inward/outward entries appear immediately, sync in background |

### 5.2 Easing & Duration

```css
--ease-out:       cubic-bezier(0.16, 1, 0.3, 1);   /* entrances */
--ease-in:        cubic-bezier(0.4, 0, 1, 1);        /* exits */
--duration-fast:  120ms;  /* button press, toggle */
--duration-base:  200ms;  /* panel open, card appear */
--duration-slow:  350ms;  /* page transition */
```

---

## 6. Spacing

4px base grid. All spacing values are multiples of 4.

| Token | Value | Common usage |
|---|---|---|
| `sp-1` | 4px | Icon gap, small nudge |
| `sp-2` | 8px | Input padding, badge padding |
| `sp-3` | 12px | Component gap |
| `sp-4` | 16px | Card padding, list item padding |
| `sp-5` | 20px | Section inner padding |
| `sp-6` | 24px | Card padding (large) |
| `sp-8` | 32px | Section gap |
| `sp-10` | 40px | — |
| `sp-12` | 48px | Touch target minimum |
| `sp-16` | 64px | Page-level section gap |

---

## 7. Terminology

### Use these words (warehouse operator language)

| Use | Not |
|---|---|
| Inward | Receiving / Intake |
| Outward | Shipping / Dispatch |
| Party / Customer | Client |
| Lot / Batch | SKU |
| Godown / Warehouse | Location / Facility |
| Bags | Units |
| Collection | Payment / Settlement / Remittance |
| Stock | Inventory |

### Never use in UI copy

`SKU`, `ASN`, `BOL`, `WMS`, `ERP`, `sync`, `commit`, `transaction`, `optimize`, `leverage`, `session expired`, `HTTP error`, `server unavailable`, `record not found`

**Rewrite examples:**

| Technical copy | Plain copy |
|---|---|
| Transaction committed successfully | 240 bags recorded ✓ |
| Sync completed | Updated |
| Record not found | We couldn't find that party |
| Session expired | Please log in again |
| HTTP 500 — server error | Something went wrong. Try again. |
| Network request failed | You're offline. Entry saved, will upload when connected. |

---

## 8. Voice & Tone

**Persona:** Experienced mandi accountant — calm, honest, brief. Never condescending. Assumes the user is busy and on their feet.

### Message patterns

**Success:** One line, past tense, specific numbers.
> 240 bags recorded ✓

**Error:** What happened + what to do. No blame.
> Couldn't save. Check your internet and try again.

**Offline:** Reassure, show count, give ETA if possible.
> Working offline. 3 entries queued — will sync when internet resumes.

**Empty state:** Tell them what to do, not what's missing.
> No stock yet. Tap + to record your first inward.

---

## 9. Accessibility Checklist

Before shipping any screen, verify:

- [ ] All body text: ≥4.5:1 contrast (AA), target 7:1 (AAA)
- [ ] Brand amber text uses `brand-text (#8C4A12)`, not `brand-ui (#C8712A)`
- [ ] All interactive elements have 48px tap zone
- [ ] Input font-size is 16px
- [ ] Focus ring visible: 3px, `rgba(200,113,42,0.12)`
- [ ] Dark mode CTA uses soil text on amber — not white
- [ ] Skeleton shown during all loading states
- [ ] Offline state is visible and shows queue count
- [ ] Error messages in plain language, no technical codes
- [ ] All strings are i18n keys — no hardcoded English in components

---

## 10. What Not to Do

| ✗ Never | Why |
|---|---|
| Pure white `#FFFFFF` as page bg in light mode | Use `#FEFCF8` — the warmth matters |
| Dark nav bars in light mode | Light mode is all-warm; dark elements belong only in dark mode |
| White text on amber buttons in dark mode | Physically fails WCAG — use soil `#1C1A16` |
| Latin-only serif fonts (Lora, Playfair) | Breaks Telugu/Hindi/Tamil rendering |
| Top tab navigation | Conflicts with side nav; creates duplicate navigation |
| Both bottom tabs AND side nav visible simultaneously | One per breakpoint only |
| Spinners as primary loading state | Use skeleton screens |
| Silent failures | Every action needs visual + haptic feedback |
| More than 3 taps for inward/outward entry | Core flows must be ≤3 taps |
| Cool tones (purple, blue-grey) | Wrong emotional register for this audience |
| Jargon in any user-facing copy | See Section 7 |

---

*StockRight Brand Language v3 — Foundation for design system implementation*  
*Review this document before making any color, typography, or component decisions.*
