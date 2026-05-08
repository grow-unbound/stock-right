---
name: stockright-design
description: Use this skill to generate well-branded interfaces and assets for StockRight — a mobile-first warehouse management system for rural and suburban Indian cold-storage operators. Contains the full StockRight v3 design language: warm paper-register palette (cream/soil/amber + locked semantic teal/rust/amber-pending), Noto type system (full Indian-script coverage), 4px spacing grid, component spec (buttons, badges, inputs, cards, top bar, bottom-tab + FAB navigation), accessibility rules (two-token brand split, 16px input floor, 48px tap targets), copy voice (mandi-accountant register), and a click-thru mobile UI kit for prototyping.
user-invocable: true
---

# StockRight Design Skill

You are now an expert in the StockRight design system. Read the rest of the files in this skill to ground every visual and copy decision.

## Where to look

- **`README.md`** — full brand language: company context, content fundamentals (voice, casing, person, vocabulary), visual foundations (color, type, motion, hover/press, borders, shadows, radii, cards, layout), iconography rules.
- **`colors_and_type.css`** — every design token as a CSS custom property (light + dark mode), plus base typography styles. Import this file at the top of any HTML you produce — never re-declare tokens.
- **`preview/`** — visual specimens for every concept (colors, type, spacing, components). Read these to *see* what each token looks like.
- **`ui_kits/stockright-app/`** — high-fidelity mobile UI kit. `components.jsx` has every atomic component (`Topbar`, `TabBar`, `Button`, `Badge`, `Input`, `Card`, `KPI`, `EntryRow`, `Toast`, all `Icon*`). `screens.jsx` has full screens. `index.html` is a runnable click-thru prototype.
- **`assets/`** — wordmark SVGs (light + dark). These are placeholders — flag if a real lockup is needed.

## How to work

If creating visual artifacts (slides, mocks, throwaway prototypes, marketing): copy the assets you need into your HTML, link `colors_and_type.css`, and write static HTML using the tokens. Lift component patterns from `ui_kits/stockright-app/components.jsx` rather than reinventing them.

If working on production code: copy assets and read the rules here to become an expert in designing with StockRight. Treat the rules as hard constraints, not suggestions — the audience (rural Indian cold-storage operators on patchy networks, primarily in Telugu/Hindi/Tamil/Kannada/Bengali) is the reason for every constraint in this system.

## Non-negotiable rules

1. **Two-token brand.** `brand-ui` (`#C8712A`) is for fills/icons/borders only. `brand-text` (`#8C4A12`) is the only legal amber for text. Never put `brand-ui` on text — its luminance physically prevents 7:1 contrast. In dark mode, `brand-ui` becomes `#E8943A` and is text-legal at 7.07:1; CTA text on amber is **soil-tinted `#2A1F12`**, never white.
2. **Locked semantic colors.** Teal = inward / arriving / positive. Rust = outward / leaving / errors / destructive. Amber = pending / collection due / offline queue. Never cross these meanings.
3. **Noto family only.** Noto Serif (display/numbers), Noto Sans (body), Noto Sans Mono (codes/labels). No Latin-only serifs — they break Indian script rendering.
4. **16px input font-size floor.** iOS auto-zoom prevention. Never reduce.
5. **48px tap-target floor** for everything tappable.
6. **One nav system per breakpoint.** Bottom tabs on mobile, side nav on desktop, never both.
7. **Network state is always visible.** The top bar shows online / offline-queued / syncing — never hide it.
8. **Skeleton screens, not spinners.** Loading states use a shimmer skeleton.
9. **Indian number system.** `₹2,47,500`, `2.5 Lakh`, `1 Crore` — never `₹247,500`, `250K`, `10M`.
10. **Date format `DD/MM/YYYY` always.**
11. **No emoji as decoration.** Functional unicode glyphs (`✓`, `●`, `⚡`, `↑`) are allowed inline in copy where they carry meaning.
12. **Copy is plain, past-tense, specific.** "240 bags recorded ✓" — never "Operation successful." See `README.md` § Content Fundamentals for the full vocabulary list.
13. **Button loading labels, not spinners in buttons.** While an action is in progress, the button shows a short label (Sending…, Verifying…, Saving…) instead of children; never put a spinner inside a primary CTA. Page-level loading still uses skeletons. Authoritative patterns: `specs/STOCKRIGHT_BRAND_v3.md` §3.5 (web `Button` uses `loadingLabel`); mobile matches.

## If invoked without guidance

Ask the user what they want to build, then ask focused follow-ups: target screen (mobile / desktop), surface (in-app screen / marketing one-pager / slide), the core flow or moment they're trying to land, and whether they want variations. Then act as an expert designer and produce HTML artifacts (or production code, if they're working in a codebase).
