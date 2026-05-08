# StockRight Monorepo Structure Analysis
## Web-First → Mobile-Scalable Architecture

---

## Confirmed Structure (as of May 2026)

> **Status: IMPLEMENTED** — This is the final confirmed structure, not a proposal.

```
stock-right/
├── apps/
│   ├── web/                          # Next.js 15 App Router (deployed to Vercel)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx        # Phone input → send OTP
│   │   │   │   │   ├── signup/page.tsx       # Full signup form
│   │   │   │   │   └── verify/page.tsx       # 6-digit OTP entry + countdown
│   │   │   │   ├── (onboarding)/
│   │   │   │   │   └── create-warehouse/page.tsx
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx            # Responsive nav (sidebar / bottom tabs)
│   │   │   │   │   ├── page.tsx              # Home / KPI dashboard
│   │   │   │   │   ├── stock/page.tsx
│   │   │   │   │   ├── parties/page.tsx
│   │   │   │   │   └── settings/page.tsx
│   │   │   │   ├── warehouse-select/page.tsx # Shown when user has >1 warehouse
│   │   │   │   ├── layout.tsx                # Root: fonts, CSS vars, QueryProvider
│   │   │   │   └── globals.css
│   │   │   ├── components/
│   │   │   │   ├── layout/                   # TopBar, SideNav, BottomTabBar, AppShell
│   │   │   │   ├── auth/                     # PhoneInput, OtpInput, SignupForm, WarehouseForm
│   │   │   │   └── ui/                       # Badge, Button, Input, Skeleton
│   │   │   ├── lib/
│   │   │   │   ├── supabase/                 # client.ts (browser), server.ts (SSR)
│   │   │   │   └── query-client.ts
│   │   │   └── hooks/
│   │   ├── public/
│   │   │   └── wordmark.svg
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts                # StockRight tokens mapped to Tailwind
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.local
│   │
│   └── mobile/                       # Expo SDK 52 + Expo Router v4
│       ├── app/
│       │   ├── (auth)/               # login.tsx, signup.tsx, verify.tsx
│       │   ├── (onboarding)/         # create-warehouse.tsx
│       │   ├── (dashboard)/          # _layout.tsx (bottom tabs), index/stock/parties/settings
│       │   ├── warehouse-select.tsx
│       │   └── _layout.tsx           # Root: AuthProvider, QueryProvider, GlueStack
│       ├── components/
│       │   ├── auth/                 # PhoneInput, OtpInput (native)
│       │   └── ui/                   # Badge, Button (+ haptics), Skeleton
│       ├── theme/
│       │   └── index.ts              # GlueStack config with @stockright/shared/tokens
│       ├── assets/
│       │   └── wordmark.svg
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                       # @stockright/shared — platform-agnostic
│   │   ├── src/
│   │   │   ├── types/                # db.ts (Supabase types re-export), models.ts, auth.ts
│   │   │   ├── api/                  # supabase.ts (client factory), auth.ts, warehouse.ts
│   │   │   ├── hooks/                # useAuth.ts, useWarehouses.ts
│   │   │   ├── utils/                # formatting.ts, validation.ts (Zod schemas)
│   │   │   ├── i18n/                 # en/common.json, te/common.json
│   │   │   └── tokens/               # index.ts — JS export of CSS tokens for mobile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── supabase/                     # @growcold/supabase — backend infrastructure
│       ├── supabase/
│       │   ├── migrations/           # 21 SQL migrations (do not edit)
│       │   └── functions/
│       │       ├── send-otp/         # Resend email OTP + auth_otp_challenges insert
│       │       ├── verify-otp/       # Hash comparison + createSession + nextStep
│       │       └── monthly-rent-accrual/
│       ├── types.ts                  # Auto-generated — run db:types to refresh
│       └── package.json
│
├── CLAUDE.md                         # Root project instructions (Golden Rule lives here)
├── .cursorrules                      # Strict adherence rules for all IDEs
├── pnpm-workspace.yaml
├── package.json                      # Root scripts only (no deps)
├── tsconfig.base.json
└── turbo.json
```

---

---

## ⚡ Golden Rule: Web ↔ Mobile Sync

> **Web and mobile MUST stay in sync at all times.**
>
> Any feature shipped on one platform must be simultaneously shipped (or explicitly deferred with a tracked issue) on the other. This is non-negotiable.

**What "in sync" means:**
- Same Zod validation schemas (live in `packages/shared/src/utils/validation.ts`)
- Same API calls via `packages/shared/src/api/`
- Same navigation paths and auth flow logic
- Same i18n keys — no hardcoded strings on either platform
- Same design tokens — Tailwind CSS vars on web, GlueStack token config on mobile
- Visual differences are limited to platform-native patterns only (Pressable vs div, SafeAreaView, haptics)

**OTP delivery:** Resend email for testing. Switch to WhatsApp by changing `OTP_PROVIDER` env var — no code changes required.

---

## Key Design Decisions

### 1. **Shared Package vs. Separate Backend**

**Question:** Is a shared `packages/shared` required for web-first approach?

**Answer:** **YES, highly recommended.** Here's why:

| Aspect | With Shared Package | Without Shared Package |
|--------|-------------------|----------------------|
| **Code Duplication** | Zero | High (API client, types, utils in web + mobile + tests) |
| **Maintenance** | Single source of truth | Nightmare—fix bug in 3 places |
| **Mobile Migration** | Copy-paste ready | Rewrite required |
| **Type Safety** | Shared types ensure consistency | Types drift between apps |
| **Build Size** | Optimized (tree-shaking) | Bloated (duplication) |

### 2. **No Separate Backend Server (Web-First)**

For the **web-first approach**, we use:
- **Supabase as the backend** (PostgreSQL, Auth, Edge Functions, Realtime)
- **No separate Node.js/Express server in v1.0**
- The `packages/supabase/` directory only contains:
  - Database migrations
  - Edge Functions (Deno-based cron jobs)
  - Seed data

This is **intentional simplification**:
- ✅ Reduces complexity for MVP
- ✅ Vercel deployment is simple (just Next.js)
- ✅ Supabase Edge Functions handle background jobs
- ✅ Easy to add a Node backend later if needed

### 3. **Vercel Deployment (Web Only)**

```
vercel.json
{
  "buildCommand": "pnpm --filter=@stock-right/web build",
  "outputDirectory": "apps/web/.next"
}
```

- **Only `apps/web` is deployed** to Vercel
- `packages/shared` is a dependency, bundled into web build
- `packages/supabase` is **not** deployed to Vercel (it's in Supabase dashboard)
- Mobile app is built separately via EAS (when time comes)

### 4. **Offline-First Architecture**

The `packages/shared/offline/` module provides:

- **Universal queue abstraction:**
  - Web: Uses IndexedDB
  - Mobile (future): Uses AsyncStorage
  - Both implement same interface

- **Sync logic:**
  - Queue local changes
  - Sync on reconnect
  - Conflict resolution (timestamp-based)

Example:
```typescript
// Both web + mobile use this exact same interface
const queue = createOfflineQueue();
await queue.enqueue('delivery', { lotId, bags });
await queue.sync(apiClient);  // When online
```

### 5. **Testing Strategy**

```
tests/
├── unit/
│   ├── shared/        # Calculation logic, utilities
│   ├── api/           # API client tests
│   └── jest.config.js
├── integration/       # Database + API flow tests
└── e2e/
    ├── auth.e2e.ts    # Web E2E (Cypress)
    └── mobile.e2e.ts  # Mobile E2E (Detox, later)
```

**Tests run against:**
- Staging Supabase project
- Can run in CI/CD on every PR
- No need for separate backend tests (we use Supabase RLS)

---

## Scalability to Mobile

When you're ready for mobile (post-MVP):

1. **Zero changes to `packages/shared`:**
   - Components already mobile-safe (no complex tables, responsive)
   - Hooks work on React Native
   - Offline logic is platform-agnostic
   - Types/API calls are universal

2. **Add `apps/mobile/`:**
   - Expo Router for navigation
   - Use same components from `shared/`
   - Replace web-specific components (DataTable → FlatList)
   - Offline storage: AsyncStorage instead of IndexedDB

3. **Example mobile migration:**
   ```typescript
   // shared/components/LotCard.tsx (works on web + native)
   import { View, Text, Pressable } from 'react-native';
   
   export function LotCard({ lot, onPress }) {
     return (
       <Pressable onPress={onPress}>
         <View>
           <Text>{lot.customerName}</Text>
         </View>
       </Pressable>
     );
   }
   ```

4. **Offline storage swap:**
   ```typescript
   // packages/shared/offline/storage.ts
   import { isNative } from 'shared/platform';
   
   export const storage = isNative 
     ? AsyncStorage  // React Native
     : IndexedDB;    // Web
   ```

---

## No Vercel Confusion

### Deploy Paths

**Web Deployment:**
```bash
# Vercel detects this via vercel.json
pnpm --filter=@stock-right/web build
# Output: apps/web/.next → deployed to Vercel
```

**Supabase Deployment:**
```bash
# CLI deploys Edge Functions to Supabase dashboard
supabase functions deploy
# Functions live in packages/supabase/functions/*
```

**Mobile Deployment (future):**
```bash
# EAS (Expo) builds Android/iOS
eas build --platform all
# No Vercel involvement
```

---

## Package.json Structure

### Root (stock-right/package.json)
```json
{
  "name": "@stock-right/monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "devDependencies": {
    "typescript": "^5.3",
    "eslint": "^8.0",
    "jest": "^29.0"
  }
}
```

### Web (apps/web/package.json)
```json
{
  "name": "@stock-right/web",
  "private": true,
  "dependencies": {
    "next": "^14.0",
    "@stock-right/shared": "*"
  }
}
```

### Shared (packages/shared/package.json)
```json
{
  "name": "@stock-right/shared",
  "private": true,
  "dependencies": {
    "@supabase/supabase-js": "^2.30"
  },
  "exports": {
    "./api": "./src/api/index.ts",
    "./components": "./src/components/index.ts",
    "./hooks": "./src/hooks/index.ts",
    "./types": "./src/types/index.ts",
    "./utils": "./src/utils/index.ts",
    "./store": "./src/store/index.ts"
  }
}
```

---

## Summary

✅ **Shared package is required** for web-first approach
✅ **No separate backend for MVP** (Supabase handles it)
✅ **Vercel deployment is clean** (only apps/web)
✅ **Mobile migration is zero-friction** (packages already platform-agnostic)
✅ **Tests are centralized** and can run in CI/CD
✅ **Deployment confusion avoided** (clear separation: web → Vercel, functions → Supabase)