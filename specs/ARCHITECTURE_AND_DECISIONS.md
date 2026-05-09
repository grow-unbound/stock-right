# Cold Storage MVP: System Architecture & Technical Decisions

---

## PART 1: SYSTEM ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐      ┌──────────────────────┐         │
│  │   React Web App      │      │  React Native Mobile │         │
│  │  (Browser)           │      │  (iOS/Android)       │         │
│  │  Tabs: Home, Stock,     │  Same tab bar: Home, │         │
│  │  Parties, Money|      |    Stock, Parties,│         │
│  │  Avatar menu: Settings,     │  Money        │         │
│  │  warehouse switch, profile  │  + same avatar menu  │         │
│  └──────────────────────┘      └──────────────────────┘         │
│                 ↓                         ↓                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              SUPABASE API (MVP — no separate Node server)        │
├─────────────────────────────────────────────────────────────────┤
│  • PostgREST (auto REST from Postgres) + RLS per request         │
│  • Supabase Auth (JWT; phone identity)                           │
│  • Optional: RPC / Edge Functions for jobs & complex mutations   │
│  • Logical “/api/…” contracts in API spec map to tables + RLS   │
│    + Edge Functions (e.g. daily stale check), not Express routes │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Authentication:                                                │
│  • Supabase Auth (Whatsapp OTP)                                 │
│  • JWT token issuance & verification                            │
│                                                                 │
│  PostgreSQL Database:                                            │
│  ┌─────────────────────────────────────────────────┐             │
│  │ Tables:                                         │             │
│  │ • tenants, warehouses                           │             │
│  │ • customers                                     │             │
│  │ • products                                      │             │
│  │ • lots (status, balanceBags, lodgementDate)     │             │
│  │ • rent_accruals (isPaid, paidDate)              │             │
│  │ • charge_accruals (isPaid, paidDate)            │             │
│  │ • deliveries (with blocking info)               │             │
│  │ • customer_receipts                             │             │
│  │ • receipt_allocations (FIFO)                    │             │
│  │ • auth.users + user_profiles + user_roles       │             │
│  │ • warehouse_settings (config)                   │             │
│  │ • audit_log (compliance)                        │             │
│  │ • transaction_charge_types (tenant settings)    │             │
│  │ • transaction_chargs (tenant settings)          │             │
│  │ • product_groups (with subgroups in same table) │             │
│  └─────────────────────────────────────────────────┘             │
│                                                                  │
│  Row-Level Security (RLS):                                       │
│  • Tenant + assigned-warehouse access (see multitenancy rules)   │
│  • Role: OWNER / MANAGER / STAFF                                  │
│  • Fine-grained row policies (e.g. STAFF lot visibility) in SQL  │
│                                                                   │
│  Realtime (Supabase):                                            │
│  • Subscribe to lot status changes                               │
│  • Live delivery updates                                         │
│  • Real-time outstanding balance updates                         │
│                                                                   │
│  Edge Functions (Cron):                                          │
│  • Daily stale check job (00:00 UTC)                             │
│  • Runs: Calculate daysOld vs staleDaysLimit                     │
│  • Updates lot status to STALE if needed                         │
│  • Logs to lot_status_history                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES (Optional)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  • Sentry (Error tracking)                                       │
│  • Posthog (Monitoring & metrics)                     │
│  • Whatsapp Business (Whatsapp notifications)                    │
│  • Supabase Storage (Invoice/document storage)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────-┘
```

---

## Forms & full-screen entry (cross-cutting)

- **Web (mobile-web):** Hide bottom tab bar + FAB on full-screen form routes using `shouldHideMobileDashboardChrome` — see `apps/web/src/lib/form-chrome.ts` (consumed by `BottomTabBar` and `DashboardPageShell`).
- **Mobile (Expo Router):** Screens that must not show the tab navigator register **outside** `(tabs)` as siblings on the dashboard `Stack` (e.g. `app/(dashboard)/money/receipt/new.tsx`). Nested tabs layout would keep the bar visible.
- **Party picker data:** Quick search uses `searchCustomersQuickPick` in `@stockright/shared/api` (direct `customers` rows, `is_active`); merged infinite scroll in UI. Detailed party balances still come from warehouse RPCs when needed.

---

## PART 2: DATA FLOW DIAGRAMS

### Flow 1: Recording a Delivery (with Blocking)

```
OpManager initiates delivery:
  1. POST /api/lots/:id/delivery { numBagsOut, notes }
  2. Backend calculates: isFinal = (balanceBags - numBagsOut) === 0
  3. If isFinal:
       → Query lot.outstanding (sum unpaid rent + charges)
       → If outstanding > 0:
            Return 409 Conflict { error, outstanding, canOverride }
            STOP
       → Else:
            Proceed to step 4
  4. If not isFinal:
       → If outstanding > 0:
            Return 200 { warning, canProceed: true }
            (Allow ops manager to proceed despite warning)
       → Else:
            Proceed to step 4
  5. Create Delivery record:
     • deliveryID = new UUID
     • numBagsOut = input
     • status = 'COMPLETED'
  6. Update Lot:
     • balanceBags -= numBagsOut
     • If balanceBags === 0: status = 'DELIVERED'
  7. Create TransactionCharges (if applicable):
     • Hamali, Platform, KataCoolie, Mamulle
     • isPaid = false
  8. Return 200 { success, deliveryID, balanceBagsAfter }

If blocked (409), Owner overrides:
  1. POST /api/lots/:id/delivery/override { overrideReason }
  2. Validate: user.role === 'OWNER' (403 if not)
  3. Validate: overrideReason is not empty
  4. Create same Delivery record (as step 5-8 above)
  5. Log to audit_log:
     • action = 'DELIVERY_OVERRIDE'
     • oldValues = null
     • newValues = { deliveryID, overrideReason }
     • reason = overrideReason
  6. Notify all OWNER users (in-app notification or email)
  7. Return 200 { success, deliveryID }
```

### Flow 2: Daily Stale Check Job

```
Cron job runs at 00:00 UTC (5:30 AM IST):
  1. Trigger: POST /api/jobs/daily-stale-check
  2. For each warehouse (or filtered):
  3.   For each lot WHERE status IN ('ACTIVE', 'STALE'):
  4.     Calculate:
         • daysOld = TODAY - lot.lodgementDate
         • staleDaysLimit = product.staleDaysLimit OR warehouse_settings.BLANKET_STALE_DAYS
  5.     If daysOld > staleDaysLimit AND lot.status !== 'STALE':
         • Update lot: status = 'STALE'
         • Insert lot_status_history:
           - oldStatus = lot.status (was ACTIVE or something)
           - newStatus = 'STALE'
           - reason = "Auto: exceeded staleDaysLimit (X days)"
           - changedBy = null (system job)
  6.     If daysOld <= staleDaysLimit AND lot.status === 'STALE':
         • (Optional) Leave as STALE (don't auto-revert)
         • OR (Better) Consider reverting if product limit increased
  7.   Log summary: { lotsMarkedStale: count, timestamp }
  8. Return 200 { success, lotsMarkedStale }

Job must be idempotent:
  • Running twice same day should not create duplicate logs
  • Check: IF lot.status !== 'STALE' before updating
```

### Flow 3: Payment Allocation (FIFO)

**Implementation (MVP):** No separate HTTP API. The client inserts into **`customer_receipts`** via Supabase (PostgREST) with RLS, then calls **`confirm_receipt_allocations`** (RPC) with allocation lines. The insert includes **`tenant_id`** from the selected warehouse row (must match **`current_tenant_id()`** for the session) and **`recorded_by`** = authenticated **`user_profiles.id`** (same as `auth.uid()`).

```
Operator records payment (web + mobile):
  1. INSERT customer_receipts {
       warehouse_id, customer_id, tenant_id (from warehouses row),
       receipt_date, total_amount, payment_method,
       reference_number?, notes?, recorded_by = auth uid
     } — RLS: tenant_id and warehouse_id must match session scope
  2. RPC confirm_receipt_allocations(p_receipt_id, p_lines) applies FIFO-style
     allocation rules inside Postgres (rent/charge lines, credit remainder).
```

Legacy pseudo-flow (conceptual FIFO ordering of unpaid items) remains useful for understanding allocation intent; the authoritative behavior lives in the **`confirm_receipt_allocations`** implementation and related migrations.

---

## PART 3: TECHNICAL DECISIONS & TRADEOFFS

### Decision 1: Supabase vs Custom Backend + Database

**Decision**: Use **Supabase as the only application backend for MVP** (PostgreSQL + Auth + PostgREST + RLS + Realtime + Edge Functions). **No dedicated Node/Express/Hono API** until a future version explicitly needs it.

**Rationale**:
- ✅ Authentication (Whatsapp OTP) built-in; **`auth.users`** is identity source of truth
- ✅ Row-Level Security (RLS) enforces access control at DB level
- ✅ PostgREST exposes CRUD; complex flows use **RPC or Edge Functions**
- ✅ Realtime subscriptions for live updates
- ✅ Edge Functions for scheduled jobs (e.g. stale check)
- ✅ Managed PostgreSQL (no ops overhead)
- ⚠️ Vendor lock-in (Supabase is open-source, but still proprietary)

**Alternative Considered**:
- Custom Node + PostgreSQL: deferred; add only if Supabase limits are hit
- Firebase: Better for real-time, but weaker SQL

**Mitigation**:
- Database layer abstraction (could migrate to self-hosted Postgres later)
- Regular backups to S3

---

### Decision 2: STALE as Status vs Warning Flag

**Decision**: STALE is a status enum, not a separate flag

**Rationale**:
- ✅ Clear state machine (ACTIVE → STALE → DELIVERED)
- ✅ Automatic triggers (daily job)
- ✅ Prevents confusion (lot can't be both ACTIVE and STALE)
- ⚠️ Temptation to confuse with "stop accruing rent" (it doesn't)

**Important Clarification**:
- STALE status = "lot is old, spoilage risk high"
- Rent continues accruing in STALE (bags still occupy shelf)
- STALE only stops when status → DELIVERED (bags removed)

**Audit Trail**:
- lot_status_history tracks all transitions
- Includes reason: "Auto: exceeded 180 days"

---

### Decision 3: Final Delivery Blocking (Stock as Leverage)

**Decision**: Hard block final delivery if customer outstanding > 0

**Rationale**:
- ✅ Enforces collections (stock is leverage)
- ✅ Prevents customer from leaving with stock unpaid
- ✅ Clear business rule
- ⚠️ Legal risk (undue lien claim)
- ⚠️ User friction (customers may dispute)

**Mitigations**:
- Owner override with mandatory reason + audit trail
- 7-day audit flag (override without payment)
- Clear T&C: "Final delivery withheld if outstanding"
- Future: 60-day max hold policy (v1.1)

**Alternative Considered**:
- Soft warning (allow anyway): Less leverage, less effective
- Hard block with NO override: Too rigid, doesn't account for OTC payment

---

### Decision 4: Accrual Stops on DELIVERED (Not ACTIVE → CLEARED)

**Decision**: Accrual stops when `status = DELIVERED` (balance zero — no stock in warehouse), not when fully cleared financially; `CLEARED` is the settled closed state and also has no accruals.

**Rationale**:
- ✅ Logical: No bags in warehouse → no rent accrues
- ✅ Accurate: "Storage rent" only applies while stock is stored
- ✅ Clear: DELIVERED = physically out, stop charging

**Alternative Considered**:
- Stop accrual only when status = CLEARED: Confusing (why charge after delivery?)
- Continue accrual until paid in full: Charges accumulate forever

---

### Decision 5: Payment Allocation FIFO (Oldest First)

**Decision**: Auto-allocate to oldest unpaid rent/charges first

**Rationale**:
- ✅ Standard accounting (FIFO)
- ✅ Transparent to customer
- ✅ Reduces outstanding balance most efficiently
- ⚠️ Customer might want specific allocation (e.g., pay one lot only)

**Mitigation**:
- Manual reallocation available to OWNER
- UI shows proposed allocations before confirm

---

### Decision 6: Role-Based Views (STAFF sees only ACTIVE/STALE)

**Decision**: STAFF cannot see DELIVERED/CLEARED/WRITTEN_OFF lots

**Rationale**:
- ✅ Reduces cognitive load (focus on actionable lots)
- ✅ Prevents accidental actions on closed lots
- ⚠️ STAFF loses visibility into closed history

**Mitigation**:
- OWNER/MANAGER can see full lot history
- Audit log available to authorized users
- OWNER can request MANAGER to show history if needed

**Enforcement**:
- RLS policy: `WHERE status IN ('ACTIVE', 'STALE')` for STAFF
- Frontend also hides (defense in depth)

---

### Decision 7: Stale Check as Daily Job (not real-time)

**Decision**: Run stale status update as daily cron at 00:00 UTC

**Rationale**:
- ✅ Simple, predictable
- ✅ No race conditions
- ✅ Idempotent (safe to re-run)
- ✅ Low database load
- ⚠️ Slight delay (lot marked STALE next day, not same day)

**Alternatives Considered**:
- Real-time trigger (on every query): Too expensive, race conditions
- Manual batch job: Requires operator action
- Hourly cron: Overkill for v1

---

### Decision 8: Warehouse Settings as Configurable

**Decision**: Each warehouse has own BLANKET_STALE_DAYS, FOLLOW_UP_OUTSTANDING_DAYS, etc.

**Rationale**:
- ✅ Flexibility (different commodities, climates)
- ✅ Different ops workflows per warehouse
- ⚠️ Adds config management burden

**Mitigation**:
- Sensible defaults (180 days blanket, 30 days follow-up)
- OWNER only access
- Documented in settings UI

---

### Decision 9: Delivery Blocking Override Requires OWNER Role

**Decision**: Only OWNER can override final delivery block

**Rationale**:
- ✅ Prevents MANAGER from circumventing collections
- ✅ Escalates to decision-maker
- ✅ Audit trail (OWNER's decision, not ops)
- ⚠️ MANAGER friction if OWNER unavailable

**Mitigation**:
- OWNER can delegate (v1.1 feature)
- Clear notification to managers when override happens
- 7-day audit flag catches abuse

---

### Decision 10: Separate ReceiptAllocations Table

**Decision**: Track how each receipt is allocated to rents/charges

**Rationale**:
- ✅ Audit trail (which charges paid by which receipt)
- ✅ Handle partial payments
- ✅ Detect orphaned/unallocated amounts
- ⚠️ Extra joins in queries

**Implementation**:
- receiptAllocations.rentAccrualID OR chargeID (mutually exclusive)
- Sum(receiptAllocations.amount) = receipt.totalAmount

---

### Decision 11: Tab activity lists (RPC + warehouse scope + offline search)

**Decision**: **Money** and **Stock** load warehouse-scoped activity via Postgres RPCs (`list_money_movements`, `count_money_movements`; `list_stock_movements`, `count_stock_movements`) with **`p_search`**, **`p_filter`**, **`p_sort_column`**, **`p_sort_direction`**, **`p_page`**, **`p_page_size`** (bounded page size). **Stock** exposes `transaction_type` as `lodgement` | `delivery`. The **active store** for the selected warehouse remains `active_warehouse_id` in client storage (web `localStorage`, mobile secure storage).

**Client behaviour (aligned across Money + Stock)**:
- **Desktop web (`sm` and up)** — Offset pagination against the server (`count` matches `list`). **Merged search**: immediate **local filter** on the loaded window (`filterMoneyRowsLocal` / `applyStockTabClientFilters`) for zero-lag typing plus **debounced server refetch** (400ms default) on the trimmed query string; show `searchAccessory` while the delayed request runs.
- **Mobile web + native** — Same merged search/filter; **`mergeUnique*` accumulation** keyed by `{transaction_type}-{event_id}` plus **near-end sentinel / scroll prefetch** (`IntersectionObserver` on web narrow, `scroll` thresholds on RN) increments `mobilePage`; **stub skeleton** row at list bottom while the next server page loads (no spinner row).

**Stale stock KPI**: **Not** inferred only from latest `daily_stock_summary` snapshot; **`public.stock_tab_stale_kpis(warehouse)`** aggregates live lots with `status = STALE` and `balance_bags > 0`. Stale chips and list filter use the same rule.

**Offline**: When offline, Stock reads **`readStockTabCache`** (baseline rows + last KPI blob from the last successful online write via `writeStockTabCache`). Current chips and the **immediate** search string run client-side on that baseline. Indicate cached source after failed network fallback when applicable.

**Rationale**:
- ✅ One mental model across register-style tabs (warehouse-scoped, RLS authoritative, `SECURITY INVOKER`)
- ✅ Desktop tables stay fast (bounded pages); handheld lists prefetch before the viewport hits the bottom
- ✅ Operators still slice saved data offline after one successful sync

**Mitigation**:
- Baseline caches can drift; KPI cards may omit fields if summary rows are missing entirely---

## PART 4: FAILURE MODE ANALYSIS

### Failure: Stale Job Doesn't Run

**Symptom**: Lots not marked STALE past deadline

**Detection**:
- Dashboard: "Last stale check: 2 days ago"
- Alert: If job doesn't run for 2 consecutive days

**Recovery**:
- Manual trigger: POST /api/jobs/daily-stale-check { warehouseID }
- Check Supabase logs for Edge Function errors
- Escalate to platform team if Supabase is down

---

### Failure: Delivery Blocking Logic Bypassed

**Symptom**: Final delivery allowed despite outstanding

**Detection**:
- Audit log: Check if blocked delivery marked DELIVERED
- Outstanding > 0 AND balanceBags = 0 (impossible state)

**Recovery**:
- Revert lot status to ACTIVE (manual SQL)
- Log to audit_log: action = 'EMERGENCY_UNLOCK', reason = 'Blocking bypass detected'
- Investigate why 409 not returned (API bug?)

---

### Failure: Payment Allocation Goes Negative

**Symptom**: Customer credited with negative outstanding (owed money back)

**Detection**:
- Query: SELECT customer, SUM(outstanding) < 0
- Audit: Check if over-payment not handled

**Prevention**:
- Transaction validation: remaining >= 0 during allocation
- Constraint: outstanding <= 0 is invalid (should be NULL or 0)

---

### Failure: Duplicate Lot Status Transitions

**Symptom**: lot_status_history has multiple same-day STALE entries

**Detection**:
- Query: SELECT lotID, newStatus, createdAt FROM lot_status_history WHERE newStatus='STALE' GROUP BY lotID, DATE(createdAt) HAVING COUNT(*) > 1

**Prevention**:
- Idempotent check: IF lot.status != STALE before updating
- Already implemented in daily stale check

---

## PART 5: SCALABILITY & PERFORMANCE

### Expected Load (Month 1)

- **Warehouses**: 5-10
- **Customers per warehouse**: 500-800
- **Lots per warehouse**: 2000-5000
- **Deliveries per day**: 20-50
- **Concurrent users**: 10-20 per warehouse

### Performance Targets

- API response time (p95): < 200ms
- Database query time: < 100ms
- Outstanding calculation: < 50ms
- Daily stale check: < 500ms

### Indexing Strategy

```sql
-- Critical indexes (query performance)
CREATE INDEX idx_lots_warehouseID_status ON lots(warehouseID, status);
CREATE INDEX idx_lots_lodgementDate ON lots(lodgementDate);
CREATE INDEX idx_rent_accruals_lotID_isPaid ON rent_accruals(lotID, isPaid);
CREATE INDEX idx_transaction_charges_lotID_isPaid ON transaction_charges(lotID, isPaid);

-- Audit trail
CREATE INDEX idx_audit_log_warehouseID_createdAt ON audit_log(warehouseID, createdAt DESC);
```

### Caching Considerations (v1.1)

- Warehouse settings: Cache for 1 day (invalidate on update)
- Customer outstanding: Cache for 5 min (hit frequently)
- Lot list: No caching (changes frequently with deliveries)

---

## PART 6: SECURITY MATRIX

| Threat | Mitigation |
|--------|-----------|
| Unauthorized lot access | RLS: WHERE warehouseID = user.warehouseID |
| MANAGER views WRITTEN_OFF | RLS: WHERE status IN ('ACTIVE', 'STALE') |
| Circumvent delivery block | Backend validates role before override |
| Manipulate outstanding amount | Audit log + immutable history |
| Fake receipts | Audit log captures who recorded payment |
| SQL injection | Supabase prepared statements + Drizzle ORM |
| Replay attack | JWT expires in 24 hours, Whatsapp OTP one-time |
| Data breach | Supabase encryption at rest + HTTPS in transit |

---

## PART 7: DEPLOYMENT TOPOLOGY

```
┌─────────────────────────────────────────────────┐
│           Production Deployment                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Clients (Web, Mobile)                          │
│    ↓ HTTPS                                      │
│  CDN (Vercel) — static web assets               │
│    ↓                                            │
│  Supabase (Auth + PostgREST + RLS + Edge Fn)    │
│    • No separate Node API tier for MVP          │
│    ↓                                            │
│  Supabase (Managed PostgreSQL)                  │
│    • Connection pooling (via Supabase Postgres) │
│    • Read replicas (if >100 concurrent)         │
│    • Automated backups (daily)                  │
│    ↓                                            │
│  Monitoring (Sentry, Posthog)                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## PART 8: Future Architecture (v1.1+)

### Features Requiring Architecture Changes

**Photo Proof for Deliveries**:
- Add deliveries.photoURL (Supabase Storage)
- Mobile camera integration
- Signature capture (e.g., Signature Pad library)

**Real-Time Notifications**:
- Supabase Realtime subscriptions (already infra ready)
- Delivery events → Realtime broadcast
- Collections follow-up alerts (Whatsapp Alerts)

**Bulk Lot Import**:
- CSV upload → S3 bucket
- Background job: Parse CSV, validate, create lots
- Async status endpoint: Check import progress

**Custom Rent Adjustment**:
- POST /api/lots/:id/rent-adjustment { amount, reason }
- Owner-only action
- Log to audit_log
- Recalculate outstanding

**Multi-Warehouse Owner Dashboard**:
- Query all warehouses
- Aggregate metrics
- Compare performance across sites

---

## VERSION HISTORY & ARCHITECTURE EVOLUTION

| Version | Architecture | Key Changes |
|---------|--------------|------------|
| 1.0 MVP | Supabase-only (PostgREST + RLS + Edge) | Lot mgmt, delivery blocking, payments, stale detection |
| 1.1 | + Storage, Realtime | Photo proof, SMS alerts, bulk import |
| 1.2 | + Redis caching | Performance optimization, real-time sync |
| 2.0 | + GraphQL API | Advanced queries, subscription support |

---

## APPENDIX: Tech Stack Summary

- **Mobile:** React Native + Expo
- **UI:** GlueStack UI, Shadcn/ui + Tailwind CSS + Zustand (for web)
- **Web:** Next.js + React + TypeScript
- **Backend/DB/Auth/Storage:** Supabase (PostgreSQL + RLS + Realtime)
- **Auth:** Supabase Auth — phone number + WhatsApp OTP (no email)
- **Validation:** Zod + TanStack Query
- **i18n:** react-i18next + expo-localization
- **Deployment:** App Store / Play Store (mobile), Vercel (web)
- **Monitoring:** Sentry, Postohg, Supabase logs