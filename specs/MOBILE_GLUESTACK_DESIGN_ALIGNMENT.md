# Mobile (GlueStack) ↔ Brand v3 alignment

This checklist maps the StockRight design system ([`specs/STOCKRIGHT_BRAND_v3.md`](./STOCKRIGHT_BRAND_v3.md)) to **`apps/mobile`** using **GlueStack UI** tokens and components. Theme overrides live in [`apps/mobile/src/theme/gluestack.config.ts`](../apps/mobile/src/theme/gluestack.config.ts).

## Color tokens (Brand v3 → GlueStack)

| Role | Token | Hex | GlueStack config key |
|------|-------|-----|----------------------|
| Brand CTA (buttons, icons, active) | `brand-ui` | `#C8712A` | `brandUI` in custom config |
| Brand text / labels | `brand-text` | `#8C4A12` | `brandText` |
| Brand hover | `brand-ui-hover` | `#AD5E1F` | — |
| Brand press | `brand-ui-press` | `#9A5418` | — |
| Brand subtle bg | `brand-subtle` | `#F5E8D8` | `brandSubtle` |
| Brand tint border | `brand-border` | `#E0B08A` | `brandBorder` |
| Page canvas | `bg-page` | `#FEFCF8` | `backgroundLight50` override |
| Card / input bg | `bg-surface` | `#FFFFFF` | `backgroundLight0` |
| Sidebar / header bg | `bg-subtle` | `#F5F0E8` | `backgroundLight100` override |
| Pressed / recessed | `bg-inset` | `#EDE6D9` | `backgroundLight200` override |
| Primary text | `text-primary` | `#1C1A16` | `textLight900` override |
| Secondary text | `text-secondary` | `#4A4237` | `textLight800` override |
| Tertiary text | `text-tertiary` | `#7A6F61` | `textLight600` override |
| Placeholder | `text-placeholder` | `#C0B8B0` | — |
| Inward (stock in / positive) | `inward` | `#0B7B6E` | `successDark` override |
| Inward bg | `inward-bg` | `#E6F5F3` | `successLight` override |
| Outward (stock out / error) | `outward` | `#A83422` | `errorDark` override |
| Outward bg | `outward-bg` | `#F7EAE7` | `errorLight` override |
| Pending (waiting / offline) | `pending` | `#7B5200` | `warningDark` override |
| Pending bg | `pending-bg` | `#FAF2D9` | `warningLight` override |

**Semantic rule:** `inward` = teal = arriving/positive. `outward` = rust = leaving/error. `pending` = amber = waiting/queued. Never swap these.

## Typography

| Usage | Spec | GlueStack direction |
|-------|------|---------------------|
| Headings / KPI numbers | Noto Serif | Load via `expo-font`; map to `$fontFamily.heading` in GlueStack config |
| Body / labels | Noto Sans | Map to `$fontFamily.body` |
| Codes / lot numbers / timestamps | Noto Sans Mono | Map to `$fontFamily.mono` |
| Body | 15px / 1.5 / 400 | `$md` token or custom ≥ 15px |
| Labels / badges | 11px / 500 / UPPERCASE | `$xs` + mono font + letter-spacing |
| H3 / card titles | 24px | `$2xl` |
| H1 / screen titles | 38px | Custom token |
| Number / KPI | 38px / 700 | Noto Serif bold |

**Input font is always 16px** — prevents iOS auto-zoom. Never use a smaller font inside `<Input>`.

## Touch targets, spacing, motion

- **Tap zone:** 48px — use `hitSlop={{ top: 6, bottom: 6 }}` on `Pressable`/`TouchableOpacity`; visual height 36px
- **Between tap targets:** ≥ 8px gap; prefer 12–16px in dense toolbars
- **Transitions:** ~200ms for buttons; skeleton shimmer 1.5s loop
- **Skeletons:** Use GlueStack `Skeleton` with dimensions matching final layout to avoid layout shift

## Behaviors

- **Offline / queue:** Top bar badge pattern from `STOCKRIGHT_BRAND_v3.md` — always visible, always shows queue count
- **Forms:** Label + input + help + error; never placeholder-only labels; `*` on required fields
- **Destructive actions:** Confirm before delete/write-off using `outward` color palette

## React Navigation (tab bar)

- **Active tint:** `#C8712A` (`brand-ui`)
- **Inactive tint:** `#7A6F61` (`text-tertiary`)
- **Tab bar background:** `#FEFCF8` (`bg-page`)
- **Tab bar border:** `#EDE6D9` (`bg-inset`)

## References

- [`specs/STOCKRIGHT_BRAND_v3.md`](./STOCKRIGHT_BRAND_v3.md) — canonical source of truth for all design decisions
