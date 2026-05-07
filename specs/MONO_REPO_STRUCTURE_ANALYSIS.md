# StockRight Monorepo Structure Analysis
## Web-First → Mobile-Scalable Architecture

---

## Proposed Structure

```
stock-right/
├── apps/
│   ├── web/                          # Next.js web app (deployed to Vercel)
│   │   ├── src/
│   │   │   ├── app/                  # Next.js app router
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── stock/
│   │   │   │   │   ├── money/
│   │   │   │   │   └── settings/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── layout.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── components/            # Web-only components (tables, complex modals)
│   │   │   │   ├── DashboardLayout.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── ...
│   │   │   ├── hooks/                 # Web-specific hooks (if any)
│   │   │   ├── lib/                   # Web utilities
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── .env.local
│   │
│   └── mobile/                        # Expo React Native app (future)
│       ├── src/
│       │   ├── app/                   # Expo router (when time comes)
│       │   ├── components/            # Mobile-specific components
│       │   ├── screens/               # Mobile screens
│       │   ├── hooks/
│       │   └── lib/
│       ├── app.json                   # Expo config
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                        # Shared code (both apps use this)
│   │   ├── src/
│   │   │   ├── api/                   # API client (universal)
│   │   │   │   ├── supabase.ts        # Supabase client setup
│   │   │   │   ├── client.ts          # Fetch-based API client
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── lots.ts
│   │   │   │   │   ├── customers.ts
│   │   │   │   │   ├── auth.ts
│   │   │   │   │   └── ...
│   │   │   │   └── types.ts           # Response/Request types
│   │   │   │
│   │   │   ├── components/            # Shared UI components (simple, mobile-safe)
│   │   │   │   ├── LotCard.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   ├── forms/
│   │   │   │   │   ├── DeliveryForm.tsx
│   │   │   │   │   └── PaymentForm.tsx
│   │   │   │   └── ui/                # Low-level UI (Button, Input, etc.)
│   │   │   │
│   │   │   ├── hooks/                 # Shared hooks (state, API calls)
│   │   │   │   ├── useLotsQuery.ts
│   │   │   │   ├── useOutstanding.ts
│   │   │   │   ├── useOfflineSync.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── store/                 # Zustand state (shared)
│   │   │   │   ├── authStore.ts
│   │   │   │   ├── lotsStore.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── types/                 # Shared TypeScript types
│   │   │   │   ├── models.ts          # Lot, Customer, Warehouse, etc.
│   │   │   │   ├── api.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── utils/                 # Shared utilities
│   │   │   │   ├── calculations.ts    # daysOld, outstanding, etc.
│   │   │   │   ├── formatting.ts
│   │   │   │   ├── validation.ts
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── locales/               # i18n (shared between apps)
│   │   │   │   ├── en/
│   │   │   │   │   └── common.json
│   │   │   │   ├── te/
│   │   │   │   │   └── common.json
│   │   │   │   └── i18n.ts
│   │   │   │
│   │   │   ├── offline/               # Offline-first logic (web + mobile)
│   │   │   │   ├── indexedDB.ts       # IndexedDB for web
│   │   │   │   ├── asyncStorage.ts    # AsyncStorage for mobile (future)
│   │   │   │   ├── queue.ts           # Universal queue abstraction
│   │   │   │   └── sync.ts            # Sync logic
│   │   │   │
│   │   │   └── index.ts               # Barrel export
│   │   │
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── supabase/                      # Supabase backend (Edge Functions, migrations)
│       ├── migrations/                # SQL migrations
│       │   ├── 001_create_tables.sql
│       │   ├── 002_add_rls.sql
│       │   └── ...
│       │
│       ├── functions/                 # Edge Functions (Cron jobs, webhooks)
│       │   ├── stale-check/
│       │   │   ├── index.ts
│       │   │   └── deno.json
│       │   ├── rent-accrual/
│       │   │   ├── index.ts
│       │   │   └── deno.json
│       │   └── ...
│       │
│       ├── seed.sql                   # Development seed data
│       └── README.md
│
├── tests/                             # Shared tests (unit, integration, E2E)
│   ├── unit/
│   │   ├── shared/
│   │   │   ├── calculations.test.ts
│   │   │   ├── formatting.test.ts
│   │   │   └── ...
│   │   ├── api/
│   │   │   ├── endpoints.test.ts
│   │   │   └── ...
│   │   └── jest.config.js
│   │
│   ├── integration/
│   │   ├── delivery-flow.test.ts
│   │   ├── payment-flow.test.ts
│   │   ├── offline-sync.test.ts
│   │   └── ...
│   │
│   └── e2e/
│       ├── auth.e2e.ts
│       ├── stock.e2e.ts
│       └── cypress.config.js          # Web E2E (Cypress)
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEVELOPMENT.md
│   └── DEPLOYMENT.md
│
├── .github/
│   └── workflows/
│       ├── test.yml                   # Run tests on PR
│       ├── deploy-web.yml             # Deploy web to Vercel
│       └── lint.yml
│
├── .gitignore
├── .npmrc                             # pnpm config
├── pnpm-workspace.yaml               # pnpm monorepo config
├── tsconfig.base.json                # Base TS config (extended by apps)
├── package.json                       # Root package.json
└── README.md
```

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