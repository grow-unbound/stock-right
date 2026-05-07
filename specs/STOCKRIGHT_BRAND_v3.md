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
| Visual height | 36px | `height: 36px` in CSS |
| Tap zone | 48px | `hitSlop={{ top: 6, bottom: 6 }}` in React Native |
| Input font | **16px always** | Prevents iOS auto-zoom on focus — never change |

### 3.2 Buttons

```
btn-primary   → background: brand-ui, color: white (AA large text)
btn-secondary → background: bg-subtle, color: text-primary
btn-ghost     → background: transparent, border: border-default
btn-danger    → background: outward-bg, color: outward
```

Sizes: `sm (28px visual)`, `default (36px)`, `lg (42px)`  
Modifiers: `btn-pill` (border-radius: 9999px), `btn-full` (width: 100%)

### 3.3 Badges / Status Pills

Always use semantic color — never use brand amber for status badges.

```
badge-inward   → inward-bg / inward text
badge-outward  → outward-bg / outward text
badge-pending  → pending-bg / pending text
badge-brand    → brand-subtle / brand-text
badge-neutral  → bg-subtle / text-tertiary
badge-online   → inward-bg / inward text
badge-offline  → pending-bg / pending text (with queued count)
```

### 3.4 Form Inputs

- Height: 36px visual, 48px tap zone
- Border: 1.5px `border-default`, 1.5px `brand-ui` on focus + 3px focus ring `rgba(200,113,42,0.12)`
- Font size: **16px — this must never be changed.** Any smaller triggers iOS auto-zoom.
- Placeholder: `text-placeholder` color, 15px font

### 3.5 Skeleton Loading

Use skeleton screens during all loading states. Never use bare spinners.

```css
background: linear-gradient(90deg, bg-subtle 25%, bg-inset 50%, bg-subtle 75%);
background-size: 200% 100%;
animation: shimmer 1.5s ease-in-out infinite;
```

### 3.6 Offline Queue Indicator

Always visible in the top bar when entries are queued. Never hide network state.

```
Online  → badge-online: "● Online"
Offline → badge-offline: "⚡ 3 queued" — always show count
Syncing → "↑ Syncing..." with progress if possible
```

---

## 4. Navigation

### 4.1 Canonical Pattern

**One navigation system per breakpoint — never show two simultaneously.**

| Breakpoint | Nav Pattern | Notes |
|---|---|---|
| Mobile `<640px` | Bottom tab bar | 4 items + FAB in center |
| Tablet `640–1024px` | Collapsible side nav | Icon-only collapsed, expand on tap |
| Desktop `>1024px` | Persistent side nav | 200px wide, always visible |

### 4.2 Bottom Tab Bar (Mobile)

- 4 tabs: Stock, Parties, Home, Settings
- FAB (floating action button) in center: primary action = "+ Inward"
- FAB: 48px diameter, brand-ui background, white "+" icon
- Active tab: `brand-ui` color, bold label
- Inactive: `text-tertiary` color
- `padding-bottom: calc(8px + env(safe-area-inset-bottom))` for iPhone notch

### 4.3 Side Nav (Desktop)

- Width: 200px
- Background: `bg-subtle`
- Border-right: 1px `border-default`
- Active item: `brand-ui` background, white text
- Section labels: Noto Sans Mono, 9px, uppercase, `text-tertiary`
- Groups: Operations, Finance, Reports

### 4.4 Top Bar

- Background: `bg-surface`
- Border-bottom: 1px `border-default`
- Height: 52px
- Contains: wordmark (left), network status badge + primary CTA (right)
- No navigation tabs — the top bar is purely chrome, not navigation

---

## 5. Motion & Animation

### 5.1 Principles

Every action must produce immediate, visible feedback. Our users come from a paper-based world — silent operations feel broken.

| Principle | Implementation |
|---|---|
| Response time | ≤150ms for visual acknowledgment |
| Acknowledge-first | Show success state optimistically, roll back on error |
| Haptics | `Haptics.impactAsync(ImpactFeedbackStyle.Medium)` on every primary CTA |
| Offline queue | Show count in header, update in real-time as entries queue/sync |
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
