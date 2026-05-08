# StockRight — Claude Code Instructions

## Project Overview

StockRight is a cold storage management platform. This is a **pnpm monorepo** with:

| Package | Stack | Purpose |
|---------|-------|---------|
| `apps/web` | Next.js 15, Tailwind CSS 4, React 19 | Web app (Vercel) |
| `apps/mobile` | Expo SDK 52, Expo Router v4, GlueStack UI | iOS + Android (EAS) |
| `packages/shared` | TypeScript, Zod | Shared types, API client, hooks, utils, i18n, tokens |
| `packages/supabase` | Supabase CLI, Deno Edge Functions | DB migrations, edge functions, generated types |

---

## ⚡ Golden Rule: Web ↔ Mobile Sync

**Web and mobile MUST stay in sync at all times.**

Any feature shipped on `apps/web` MUST be simultaneously shipped on `apps/mobile`, or explicitly deferred with a tracked GitHub issue. There are no exceptions. The reverse also applies — mobile-only features must have a web equivalent or a tracked deferral.

This means:
- Same Zod validation schemas (from `@stockright/shared/utils`)
- Same API calls (from `@stockright/shared/api`)
- Same navigation logic and routing outcomes
- Visual differences are limited to platform-native patterns only (Pressable vs div, SafeAreaView, haptics)

---

## Development Commands

```sh
# From repo root
pnpm dev:web          # Next.js on :3000
pnpm dev:mobile       # Expo (QR code for device)
pnpm build:web        # Production Next.js build
pnpm typecheck        # tsc --noEmit across all packages

# Supabase
pnpm db:start         # Start local Supabase (Docker required)
pnpm db:stop          # Stop local Supabase
pnpm db:reset         # Reset DB + re-run all migrations
pnpm db:types         # Regenerate packages/supabase/types.ts
```

---

## Design System

**Always consult `specs/STOCKRIGHT_BRAND_v3.md` before any UI decision.**

Key rules:
- Background: `--bg-page` (#FEFCF8) — warm cream, never pure white
- Brand fills/icons: `--brand-ui` (#C8712A) — amber, fills and icons ONLY
- Brand text: `--brand-text` (#8C4A12) — darker amber, ALL text uses this
- Inward (receive/deposit): `--inward` (#0B7B6E) — teal
- Outward (dispatch/error): `--outward` (#A83422) — terra cotta
- Pending/billing: `--pending` (#7B5200)
- Fonts: Noto Sans (UI), Noto Serif (headings), Noto Sans Mono (numbers) — Telugu/Devanagari subsets required
- Input `font-size: 16px` LOCKED — iOS auto-zoom prevention
- Touch targets: 48px minimum
- Loading: skeleton screens only, never bare spinners
- Colors live in `design-system/colors_and_type.css` — never hardcode hex values

---

## Auth Architecture

Custom OTP flow via Supabase Edge Functions (NOT Supabase phone auth):

1. `send-otp` — generates 6-digit OTP, hashes SHA-256+salt, stores in `auth_otp_challenges`, sends via Resend email
2. `verify-otp` — validates hash, provisions user on signup, calls `auth.admin.createSession()`, returns `nextStep`
3. `nextStep` routing: `create_warehouse` → `/create-warehouse`, `select_warehouse` → `/warehouse-select`, `home` → `/`

OTP delivery: Resend email (env `OTP_PROVIDER=resend`). Abstracted for future WhatsApp migration.

**Required Supabase secrets** (set with `supabase secrets set`):
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

---

## Supabase Conventions

- Supabase package is `@growcold/supabase` (NOT `@stockright/supabase`)
- All migrations in `packages/supabase/supabase/migrations/`
- Generated types at `packages/supabase/types.ts` — re-run `pnpm db:types` after schema changes
- Auth tables: `auth_otp_challenges`, `user_profiles`, `user_roles`, `user_warehouse_assignments`
- Domain tables in `public` schema — see `20260407120000_initial_schema.sql`

---

## Deployment

| Target | Command | Notes |
|--------|---------|-------|
| Web | `vercel deploy` or push to `main` | Auto-deploys via Vercel GitHub integration |
| Edge Functions | `supabase functions deploy send-otp verify-otp create-warehouse` | Deploy to linked project |
| Mobile iOS | `eas build --platform ios --profile production` | Requires Apple Developer account |
| Mobile Android | `eas build --platform android --profile production` | Requires Google Play account |

---

## File Conventions

- Path alias `@/` maps to `./src/` in `apps/web`, directly to root in `apps/mobile`
- Never hardcode colors — always use CSS tokens (web) or `tokens.*` from `@stockright/shared/tokens` (mobile)
- No inline styles on web — Tailwind utility classes only
- No bare `className` strings for colors — always reference `var(--token-name)`
- Comments: only when the WHY is non-obvious. No docblocks, no change-log comments
