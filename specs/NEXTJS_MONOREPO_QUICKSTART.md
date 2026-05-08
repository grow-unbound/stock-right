# StockRight: Next.js Monorepo - Quick Start Guide

**Updated:** April 15, 2026  

---

## Your Monorepo Structure

```
stock-right/
├── apps/
│   └── web/                    # Next.js app (→ deployed to Vercel)
│       ├── src/app/            # Next.js App Router pages
│       ├── src/components/      # Web-specific components
│       ├── next.config.js
│       └── package.json
│
├── packages/
│   ├── shared/                 # Shared code (web + mobile future)
│   │   ├── src/api/            # API client, contracts, endpoints
│   │   ├── src/components/      # Shared UI (mobile-safe)
│   │   ├── src/hooks/          # Shared hooks
│   │   ├── src/store/          # Zustand stores
│   │   ├── src/types/          # TypeScript types
│   │   ├── src/utils/          # Calculations, formatting, validation
│   │   ├── src/locales/        # i18n (English + Telugu)
│   │   └── src/offline/        # Offline queue logic
│   │
│   └── supabase/               # Backend (Supabase)
│       ├── migrations/         # SQL migrations
│       ├── functions/          # Edge Functions (Deno)
│       └── seed.sql
│
├── tests/                      # Tests for all apps
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── .cursorrules                # cursor coordination rules
```

---

## Key Design Decisions

### 1. Shared Package Required? **YES**

✅ **With shared:**
- API contracts in one place
- Types consistent between web + mobile
- Calculations reused (no duplication)
- Mobile migration is copy-paste ready

❌ **Without shared:**
- API client duplicated in web + mobile
- Types drift
- Bug fixes in 3 places
- Mobile rewrite needed

### 2. Separate Backend Server? **NO (for MVP)**

MVP uses **Supabase as backend**:
- Authentication: Supabase Auth
- Database: PostgreSQL
- Background jobs: Edge Functions (Deno)
- Real-time: Supabase Realtime

**No Node.js/Express needed.** This stays simple for Vercel deployment.

### 3. Vercel Deployment

```
vercel.json in root:
{
  "buildCommand": "pnpm --filter=@stock-right/web build",
  "outputDirectory": "apps/web/.next"
}
```

**Only `apps/web/` deploys to Vercel.**
- `packages/shared` bundled into build
- `packages/supabase` lives in Supabase dashboard
- No deployment confusion

### 4. Mobile Ready Now?

✅ **Yes, fully prepared:**
- `packages/shared` already mobile-safe (no DOM, React Native compatible)
- Offline logic platform-agnostic (IndexedDB for web → AsyncStorage for mobile)
- Components tested for mobile viewport (no wide tables)
- When you add `apps/mobile/`, it reuses 80% of `packages/shared`

---

## Deployment Checklist (M7)

### Web (Vercel)
- [ ] `apps/web` builds without errors
- [ ] All tests pass
- [ ] Lighthouse >85
- [ ] No ENV secrets in code
- [ ] Staging deployment works
- [ ] Production deployment ready

### Supabase (Dashboard)
- [ ] All migrations applied
- [ ] RLS policies verified
- [ ] Edge Functions deployed
- [ ] Seed data loaded
- [ ] Backups configured

### Mobile (EAS, future)
- [ ] `apps/mobile` builds with Expo
- [ ] Offline sync works
- [ ] All shared components work
- [ ] Performance >60fps

---

## Common Commands

```bash
# Setup
pnpm install
cd apps/web && pnpm dev           # Start Next.js on localhost:3000

# Testing
pnpm test                         # All tests
pnpm test --watch                 # Watch mode
pnpm test --coverage              # Coverage report

# Linting
pnpm lint

# Building
pnpm --filter=@stock-right/web build

# Git
git checkout -b frontend/M0-scaffold
git commit -m "[frontend]: [M0] Add LotCard component"
git push origin frontend/M0-scaffold
# → Create PR on GitHub
```
---

## TLDR

✅ **Structure:** monorepo (Next.js web + Expo mobile future)
✅ **Backend:** Supabase (no separate Node server for MVP)
✅ **Coordination:** API contracts & schema (posted in Linear)
✅ **Deployment:** Web → Vercel, Backend → Supabase
✅ **Ready:** Start M0 immediately

---

**Let's build. 🚀**