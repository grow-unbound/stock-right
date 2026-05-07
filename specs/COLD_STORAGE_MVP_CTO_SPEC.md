# Cold Storage Management System MVP
## CTO Technical Architecture & Business Logic Specification

**Status**: Ready for Implementation
**Last Updated**: Feb 18, 2026
**Owner**: CTO

---

## EXECUTIVE SUMMARY

This is a 3PL cold storage management system for unorganized Indian warehouses. Core insight: **stock is leverage for collections**. Business model accrues rent monthly, blocks final deliveries if customers owe, and tracks spoilage by commodity.

**Key Guardrails**:
- Rent accrues from lodgement date, stops when stock is delivered
- Final delivery blocked if customer outstanding > 0 (owner override with audit trail)
- Stale status auto-triggered when lot exceeds product-specific spoilage limit
- Role-based views enforce owner separation
- Payment allocation via FIFO with manual override

---

## PART 1: BUSINESS LOGIC (FINALIZED)

### 1.1 Lot Lifecycle & Status Transitions

#### LotStatus ENUM
```
ACTIVE       → Has bags in storage (0 < balanceBags < original)
STALE        → Lot age exceeds product's staleDaysLimit (auto-triggered)
DELIVERED    → All bags out (balanceBags = 0), but outstanding remains
CLEARED      → All bags out AND all unpaid rent/charges = 0
WRITTEN_OFF  → Owner marked as loss/unsalvageable (owner-only action)
DISPUTED     → Owner marked as contested/under negotiation (owner-only action)
```

#### Transitions
```
ACTIVE → DELIVERED       (when balanceBags becomes 0)
ACTIVE → STALE           (when daysOld > staleDaysLimit, daily job)
STALE → DELIVERED        (when balanceBags becomes 0)
DELIVERED → CLEARED      (when outstanding = 0 AND balanceBags = 0)
ACTIVE/STALE/DELIVERED → WRITTEN_OFF (owner action, async approval optional)
ACTIVE/STALE/DELIVERED → DISPUTED (owner action, async approval optional)
```

**Important**: WRITTEN_OFF and DISPUTED are terminal states for accruals. No new charges accrue.

---

### 1.2 Accrual & Outstanding Logic

#### Outstanding Calculation (Fixed)
```
Outstanding = SUM(unpaid RentAccruals) + SUM(unpaid TransactionCharges)
              where lot status ≠ WRITTEN_OFF

DaysSinceLodgement = TODAY - lot.lodgementDate
FollowUpTrigger = HasOutstanding AND DaysSinceLodgement > FOLLOW_UP_OUTSTANDING_DAYS (default: 30)
```

#### Accrual Stops When
- `status = DELIVERED` (all bags removed, no rent accrues on empty shelf)
- `status = CLEARED` (no outstanding, lot is closed)
- `status = WRITTEN_OFF` (loss recorded, no further charges)

#### Accrual Continues When
- `status = ACTIVE` (bags in storage, rent accrues daily)
- `status = STALE` (warning flag, but bags still occupy shelf → rent continues)

**CTO Note**: STALE is a *data flag*, not a *functional brake*. Don't confuse status with behavior.

---

### 1.3 Spoilage Risk & Stale Detection

#### Two-Level Stale Detection

**A. Product-Level Spoilage Limit**
- Each `Product` has `staleDaysLimit` (e.g., Potato: 180, Onion: 60)
- When `daysOld = TODAY - lot.lodgementDate` exceeds `staleDaysLimit`:
  - Lot status auto-sets to STALE (daily job, idempotent)
  - Owner sees: "Lot 125 STALE (180+ days, product spoils at 180)"
  - Context: "Spoilage risk high. Discuss delivery with customer or mark written-off."

**B. Blanket Stale Fallback**
- If `Product.staleDaysLimit = NULL`:
  - Use `WarehouseSettings.BLANKET_STALE_DAYS` (default: 180)
  - Apply same logic as product-level

#### Display Rules (Frontend)

For **ACTIVE** lots:
```
"Days until stale: X days"
  - Green if X > 30 days
  - Yellow if 10 ≤ X ≤ 30 days
  - Red if X < 10 days
```

For **STALE** lots:
```
"🔴 STALE - 165 days old (limit: 180 days)"
```

---

### 1.4 Stock as Leverage & Delivery Blocking

#### Delivery Initiation Logic
When ops manager initiates delivery (`balanceBags > 0`, `numBagsOut > 0`):

**CASE A: Normal Delivery** (not closing lot)
- Condition: `balanceBags - numBagsOut > 0`
- Action: **CONFIRM + ALLOW**
- UI: "⚠️ Customer outstanding ₹[X]. Confirm delivery?"
- Outcome: Ops manager is aware, proceeds consciously

**CASE B: Final Delivery** (closing lot, removing last bags)
- Condition: `balanceBags - numBagsOut = 0`
- Sub-condition: `customer.outstanding > 0`
- Action: **BLOCK** (do not allow delivery)
- UI: "🔴 Cannot deliver final bags. Customer outstanding ₹[X]. Contact owner."
- Override: Owner can override (mandatory reason + audit log)

#### Override Audit Trail
When owner overrides final delivery block:
```
Requirement:
- Mandatory reason field (e.g., "Payment received OTC", "Customer dispute resolved")
- Log entry: timestamp + owner ID + reason + delivery ID
- Notify warehouse owners: "Owner [Name] overrode delivery block for Lot [ID] - Reason: [text]"
- Future alert: If delivery completed but payment NOT received within 7 days → flag for audit
```

**CTO Recommendation**: This prevents coercion scenarios where owner is pressured by customer.

---

### 1.5 Rental Modes & Accrual

#### Yearly Rent
- Starts accruing: `lodgementDate`
- First accrual: `Monthend of lodgementDate`
- No more accurals for the remaining part of the year (of lodgement)
- Next accrual based on Brought Forward logic below
- Eligible lots: lot.lodgement_date <= **yearly rent cutoff** for that calendar year (see `warehouse_settings.yearly_rent_cutoff_month` / `yearly_rent_cutoff_day`, recurring every year — e.g. May 31 → if lot was lodged Jan 1–May 31 **inclusive** → yearly rent for that lodgement year)

#### Monthly Rent
- Starts: `lodgementDate`
- First accrual: `Monthend of lodgementDate`
- Recurring: Monthly thereafter (on monthends)
- Eligible lots: lot.lodgement_date **>** same cutoff for that calendar year (e.g. for cutoff May 31 — lots lodged **after** May 31 through Dec 31 → **monthly** rent for that lodgement year)

#### Brought Forward (Carryover)
- Carried over on 1st Jan of the following year
- Add monthly rents for the graceperiod #months - use `WarehouseSettings.GRACE_PERIOD_MONTHS`
- Adds to previous month's rent (no interest multiplier)

#### Rent Accrual Logic (Runs monthly - monthend date)
- For any lot, initial yearly vs monthly for lodgement calendar year: `lodgement_date <= cutoff(lodgement_year)` → yearly (see `yearly_rent_cutoff_month` / `yearly_rent_cutoff_day`); else monthly
- max_bags_in_month (peak bags in warehouse during the month) = opening balance at month start + bags delivered in month (equivalently: `original_bags` minus deliveries before month start, when there are no inward increases on the same lot)
- if rental_mode = YEARLY, rent_accrued = original_bags * yearly_rent_per_bag for product (accrued only once in the month of lodgement for the year; no further rent accruals during the year)
- if rental_mode = MONTHLY, rent_accrued = max_bags_in_month * monthly_rent_per_bag for product (accrued end of every month) until the end of the lodgement calendar year, while the lot still has stock in that month
- Accruals **stop** when the lot has **no bags** in storage for that month (e.g. after full delivery: `DELIVERED` / `CLEARED`) and for `WRITTEN_OFF` / `DISPUTED`
- On Jan 1st, all lots with balance_bags > 0 are brought forward
- For brought_forward lots (lodgement_date year < current calendar year), rent_accrual is MONTHLY using above logic for `WarehouseSettings.GRACE_PERIOD_MONTHS` counting from January (months 1 … N); **after** the grace window, **one YEARLY** accrual in calendar month **N+1** on **remaining bags** (opening balance for that month × `yearly_rent_per_bag`) so the yearly charge is not deferred to December (lots may be delivered/cleared earlier). If `grace_period_months >= 12`, there is no separate in-year yearly row after grace (all months fall under BF monthly). Implemented in Postgres: `generate_rent_accruals_for_month` (monthly job uses narrowed lot scope by default), `backfill_rent_accruals` (passes full scope).
- Lots can get brought forward across years if there are balance_bags on the lot on Jan 1st. In such case, repeat above BroughtForward logic for the new year as well.


**Cutoff Logic**
- Yearly rent considered for lots where lot.lodgement_date <= cutoff for **that** lodgement calendar year (from `yearly_rent_cutoff_month` / `yearly_rent_cutoff_day`)
- Monthly rents considered for lots where lot.lodgement_date **>** that cutoff
- Grace period for Brought Forward lots: `WarehouseSettings.GRACE_PERIOD_MONTHS` (e.g., 1 month = 30 days before cutoff)

---

### 1.6 Handling Charges (Per-Transaction)

Charges applied to each delivery transaction:
- **Hamali**: Manual labor per bag (₹/bag)
- **Platform**: Transaction fee (fixed or %)
- **KataCoolie**: Weight-based handling (₹/quintal)
- **Mamulle**: Miscellaneous (fixed or %)
- **Insurance**: Insurance per bag (₹/bag)

Stored in `TransactionCharges` table, linked to `Delivery` record.

---

### 1.7 Payment Allocation

#### Default: FIFO
- Oldest unpaid charge/rent accrued first
- Manual override: Owner can allocate payment to specific rent/charge

#### ReceiptAllocations Table
```
id, receiptID, chargeID (foreign key), amount, createdAt
```

When payment allocated to `WRITTEN_OFF` lot:
- Require owner confirmation (manual, not auto)
- Log: "Payment to written-off lot [ID] - Owner approved"

---

## PART 2: DATABASE SCHEMA (UPDATED)

### Core Tables (Pre-Existing)

1. **Tenants** (business / org)
   ```
   id (PK), name, phone (no email), address, createdAt, udpatedAt, createdBy, updatedBy
   ```

2. **Warehouses**
   ```
   id (PK), tenantID (FK → tenants), warehouseName, warehouseCode, city, state, address, status (ENUM: ACTIVE, INACTIVE),
   createdAt, updatedAt, createdBy, updatedBy, ...
   ```

3. **Customers**
   ```
   id (PK), customerName, customerCode ([a-zA-Z/\-0-9]),  phone (no email), warehouseID (FK), 
   mobile (no email), town, address, gstin, 
   category (ENUM: FARMER, TRADER), 
   createdAt, updatedAt, createdBy, updatedBy, ...
   ```

4. **Products**
   ```
   id (PK), productName, productGroupID (FK), staleDaysLimit (INT, nullable),
   description,
   monthlyRentPerKg (DECIMAL), yearlyRentPerKg (DECIMAL), bagSize (INT - in kgs)
   monthlyRentPerBag (DECIMAL), yearlyRentPerBag (DECIMAL), staleDaysLimit (INT),
   status (ENUM: ACTIVE, INACTIVE),
   createdAt, updatedAt, createdBy, updatedBy, ...
   ```

5. **Lots**
   ```
   id (PK), warehouseID (FK), customerID (FK), productID (FK),
   originalBags (INT), balanceBags (INT),
   lodgementDate (DATE),
   status (ENUM: ACTIVE, STALE, DELIVERED, CLEARED, WRITTEN_OFF, DISPUTED),
   rentalMode (ENUM: YEARLY, MONTHLY, BROUGHT_FORWARD), notes (array of notes {note, date}),
   createdAt, updatedAt,
   createdBy, updatedBy
   ```

6. **RentAccruals**
   ```
   id (PK), lotID (FK), accrualDate (DATE),
   rentalAmount (DECIMAL), rentalMode (ENUM),
   isPaid (BOOLEAN: default false),
   paidDare (DATE, nullable),
   paidAmount (DECIMAL),
   createdAt, updatedAt,
   createdBy, updatedBy
   ```

7. **ChargeAccruals**
   ```
   id (PK), lotId(FK), deliveryID (FK, nullable for lodgement), chargeTypeId (FK)
   ratePerUnit (DECIMAL, nullable), numBags (INT), chargeAmount (DECIMAL), 
   isPaid (BOOLEAN: default false),
   paidDate (DATE, nullable),
   paidAmount (DECIMAL: default 0),
   createdAt, updatedAt,
   createdBy, updatedBy
   ```

8. **Deliveries**
   ```
   id (PK), lotID (FK), numBagsOut (INT), deliveryDate (DATE),
   notes (TEXT),
   blockedReason (TEXT, nullable - if delivery was blocked/overridden),
   overriddenBy (USER_ID, FK nullable - owner who overrode block),
   overrideReason (TEXT, nullable),
   createdAt, updatedAt
   ```

9. **CustomerReceipts**
   ```
   id (PK), customerID (FK), receiptDate (DATE),
   totalAmount (DECIMAL), paymentMethod (TEXT),
   notes (TEXT),
   createdAt, updatedAt,
   createdBy, updatedBy
   ```

10. **ReceiptAllocations** - Every Receipt is assigned to one or more charges/rents accrued
   ```
   id (PK), receiptID (FK), chargeID (FK nullable), rentId (FK nullable), amount (DECIMAL),
   createdAt, updatedAt,
   createdBy, updatedBy
   ```

11. **Identity & membership** (Supabase: **`auth.users`** is golden source for phone auth)
    - **`user_profiles`**: `id` (PK) = `auth.users.id`, `phone`, `display_name`, optional `avatar_url`, `is_active`, timestamps
    - **`user_roles`**: `user_id`, `tenant_id`, `role` (ENUM: **OWNER, MANAGER, STAFF**). 
    - **`user_warehouse_assignments`**: `user_id`, `warehouse_id` — which godowns this user may access

12. **AuditLog**
    ```
    id (PK), userID (FK → user_profiles), entityType (TEXT), entityID (TEXT), action (TEXT),
    oldValues (JSONB), newValues (JSONB), reason (TEXT),
    createdAt, createdBy
    ```

### NEW/UPDATED Tables

13. **WarehouseSettings**
    ```
    id (PK), warehouseID (FK, unique),
    BLANKET_STALE_DAYS (INT, default: 180),
    FOLLOW_UP_OUTSTANDING_DAYS (INT, default: 30),
    YEARLY_RENT_CUTOFF_MONTH (INT 1–12, e.g., 5 = May),
    YEARLY_RENT_CUTOFF_DAY (INT 1–31, recurring annually, e.g., 31 → May 31),
    GRACE_PERIOD_MONTHS (INT, default: 1),
    createdAt, updatedAt,
    createdBy, updatedBy
    ```

14. **LotStatusHistory** (for audit trail)
    ```
    id (PK), lotID (FK), oldStatus (ENUM), newStatus (ENUM),
    reason (TEXT), changedBy (USER_ID, FK),
    createdAt, updatedAt,
    createdBy, updatedBy
    ```

15. **TransactionChargeTypes** (for tenant level customizations - e.g. Mamulle, Hamali, Insurance, KataCoolie, PlatformCoolie)
    ```
    id (PK), name, description, status (ENUM: ACTIVE, INACTIVE),
    description,
    createdAt, updatedAt,
    createdBy, updatedBy
    ```

16. **TransactionCharges** (configuration per product)
    ```
    id (PK), productId (FK), chargeTypeId (FK), chargePerBag (DECIMAL),
    description, status (ENUM: ACTIVE, INACTIVE)
    createdAt, updatedAt,
    createdBy, updatedBy
    ```

17. **ProductGroups** (allow subgroups e.g. Chillies 341, Chillies Endo 5, Chillies Talu, etc.)
    ```
    id (PK), name, parentGroupId (FK), description,
    createdAt, updatedAt,
    createdBy, updatedBy
    ```

---

## PART 3: API SPECIFICATION

### Authentication
- **Method**: Supabase Whatsapp OTP (**no email** in product domain)
- **Identity**: **`auth.users`**; app reads **`user_profiles`** + **`user_roles`** for `tenant_id` and **OWNER / MANAGER / STAFF**
- **APIs**: MVP uses **Supabase client + RLS** (and Edge Functions where needed), not a separate Node `/api` tier. Bearer JWT on all calls.

---

### Core Endpoints

#### Lot Management

**GET /api/lots**
- Query params: `warehouseID`, `status`, `customerID`, `sortBy=lodgementDate`
- Response: Array of lots with calculated `daysOld`, `daysUntilStale`, `outstanding`
- Role: MANAGER/OWNER only, STAFF sees lots with status=ACTIVE/STALE

**GET /api/lots/:id**
- Response: Full lot details + accrual history + delivery history
- Includes: `daysOld`, `daysUntilStale`, `isStale`, `outstanding`, `allChargesPaid`
- Role: All Roles

**POST /api/lots**
- Body: `{ warehouseID, customerID, productID, originalBags, lodgementDate, rentalMode, rentalAmount }`
- Response: Created lot with status=ACTIVE
- Role: MANAGER/OWNER only

**POST /api/lots/:id/delivery** (NEW VALIDATION)
```
Body: { numBagsOut, deliveryNotes }
Validation:
  1. Check: balanceBags - numBagsOut = 0? (final delivery?)
  2. If final delivery:
     - Get customer outstanding
     - If outstanding > 0:
       - Return 409 Conflict: { error: "Cannot deliver final bags", outstanding: X, code: "FINAL_DELIVERY_BLOCKED" }
       - Include override options: { canOverride: isOwner, requiresApproval: !isOwner }
  3. If normal delivery (not final):
     - If outstanding > 0:
       - Return 200 + warning: { warning: "Customer outstanding ₹X. Confirm?", canProceed: true }
  4. Record delivery, update balanceBags, check if status should change to DELIVERED

Override Flow:
  POST /api/lots/:id/delivery/override
  Body: { overrideReason }
  Headers: User must be OWNER
  Response: Delivery created + audit log entry + notification to owners
```

**POST /api/lots/:id/written-off** (Owner only)
```
Body: { reason }
Role: OWNER only → return 403 if not owner
Behavior:
  - Set lot status = WRITTEN_OFF
  - Stop accruing new charges
  - Log reason + timestamp
  - Freeze chargesOnthis lot (chargesFrozen = true)
```

**POST /api/lots/:id/disputed** (Owner only)
```
Body: { reason, resolutionTarget (nullable) }
Role: OWNER only → return 403 if not owner
Behavior:
  - Set lot status = DISPUTED
  - Continue accruing (owner can manually stop if needed)
  - Log details
```

---

#### Payments & Collections

**GET /api/customers/:id/outstanding**
Role: OWNER/MANAGER
Response: `{ totalOutstanding, daysOutstanding, unpaidCharges: [...], unpaidRents: [...] }`
Behavior:
- `daysOutstanding` only if `totalOutstanding > 0`

**POST /api/customers/:id/receipts**
```
Body: { receiptDate, totalAmount, paymentMethod, notes }
Response: receiptID
Role: OWNER/MANAGER
Behavior:
  - Create CustomerReceipt record
  - Auto-allocate to oldest unpaid charges (FIFO)
  - Return allocation details: { allocations: [{ chargeID, amount, paidDate }] }
```

**POST /api/customers/:id/receipts/:id/reallocate**
```
Body: { allocations: [{ chargeID, amount }, ...] }
Role: OWNER/MANAGER
Behavior:
  - Validate total = receipt.totalAmount
  - Clear old allocations, create new ones
  - Log reallocation reason
```

---

#### Warehouse Settings
Role: OWNER only

**GET /api/warehouse-settings/:warehouseID**
```
Response: {
  BLANKET_STALE_DAYS,
  FOLLOW_UP_OUTSTANDING_DAYS,
  YEARLY_RENT_CUTOFF_MONTH,
  YEARLY_RENT_CUTOFF_DAY,
  GRACE_PERIOD_MONTHS
}
```

**POST /api/warehouse-settings/:warehouseID** (Owner only)
```
Body: { BLANKET_STALE_DAYS, FOLLOW_UP_OUTSTANDING_DAYS, ... }
Response: Updated settings
Role: OWNER only
```

---

#### Dashboard & Analytics

**GET /api/dashboard/summary** (Home tab)
Role: OWNER/MANAGER
```
Response: {
  activeLotsCount,
  staleLotsCount,
  customersWithOutstanding: [
    { customerID, customerName, outstanding, daysOutstanding, followUpRequired: true/false }
  ],
  collectionsFollowUpDue: [...],
  recentDeliveries: [...],
  totalOutstandingAcrossWarehouse
}
```

**GET /api/dashboard/inventory** (Inventory tab)
Role: OWNER/MANAGER
```
Response: Lot list with:
  - daysOld, daysUntilStale, spoilageRiskLevel (green/yellow/red),
  - outstanding, status
```

---

### Job Endpoints (Internal)

**POST /api/jobs/daily-stale-check** (Internal, scheduled 00:00 UTC)
```
Body: { warehouseID (optional, null = all) }
Behavior:
  - For each lot where status = ACTIVE or STALE:
    - Calculate daysOld = TODAY - lodgementDate
    - Get staleDaysLimit from product or fallback to BLANKET_STALE_DAYS
    - If daysOld > staleDaysLimit AND status ≠ STALE:
      - Update status = STALE
      - Log to LotStatusHistory
  - Idempotent (don't re-update if already STALE)
```

---

## PART 4: FRONTEND ARCHITECTURE

### State Management (Recommendation: Zustand + React Query)

#### Lot Store
```typescript
interface LotState {
  lots: Lot[]
  selectedLot: Lot | null
  filters: { status, warehouseID, sortBy }

  fetchLots: () => Promise
  fetchLotDetail: (id) => Promise
  initiatDelivery: (id, numBagsOut) => Promise
    // Handles 409 conflict → show modal for override
  overrideDeliveryBlock: (id, reason) => Promise
  markWrittenOff: (id, reason) => Promise
  markDisputed: (id, reason) => Promise
}
```

#### Payment Store
```typescript
interface PaymentState {
  receipts: CustomerReceipt[]
  allocations: ReceiptAllocation[]

  fetchCustomerReceipts: (customerID) => Promise
  createReceipt: (customerID, amount, ...) => Promise
  reallocateReceipt: (receiptID, allocations) => Promise
}
```

#### Settings Store
```typescript
interface SettingsState {
  warehouseSettings: WarehouseSettings

  fetchSettings: (warehouseID) => Promise
  updateSettings: (warehouseID, values) => Promise
    // OWNER only, enforced in reducer
}
```

---

### Component Architecture

#### Role-Based Views

**All users see**:
- Lot list (filtered by role)
- Customer outstanding
- Recent deliveries

**Shared navigation (web + mobile)**  
Bottom tabs: **Home**, **Inventory**, **Parties**, **Transactions**,
 **Settings**, **warehouse switch**, and **profile** live under the **user avatar menu** (not tabs), with items **gated by role**.

**STAFF only sees**:
- ACTIVE + STALE lots only
- Delivery form
- Lot form
- Customer Receipts
- Avatar: profile + warehouse switch (if assigned); **no** owner settings
- No Write-off/Dispute options

**MANAGER only sees**:
- All lots
- Delivery form
- Lot form
- Customer Receipts
- Payment reallocation
- Avatar: profile + warehouse switch; **no** warehouse settings panel
- No Write-off/Dispute options

**OWNER sees**:
- All lots (including DELIVERED, CLEARED, WRITTEN_OFF, DISPUTED)
- Avatar: **Settings** (warehouse settings / owner config), warehouse switch, profile
- Write-off/Dispute buttons
- Payment reallocation
- Audit log
- Delivery override form

---

#### Key Components

1. **LotCard** (Inventory view)
   ```
   Props: lot, daysOld, daysUntilStale, isStale, outstanding
   Displays:
     - Lot ID, Customer, Product, Bags remaining
     - Status badge (color-coded)
     - "Days until stale: X" or "STALE - X days old"
     - Outstanding amount + days since lodgement
     - Action buttons (filtered by role)
   ```

2. **DeliveryModal**
   ```
   Case A: Normal delivery (show warning)
     "⚠️ Customer outstanding ₹X. Confirm?"
     Confirm button enabled

   Case B: Final delivery blocked
     "🔴 Cannot deliver final bags. Customer outstanding ₹X."
     If user is OWNER: "Override?" button (shows reason field)
     Else: "Contact owner to override"
   ```

3. **SettingsPanel** (OWNER only — opened from avatar menu)
   ```
   Form:
     - BLANKET_STALE_DAYS
     - FOLLOW_UP_OUTSTANDING_DAYS
     - YEARLY_RENT_CUTOFF_MONTH / YEARLY_RENT_CUTOFF_DAY (recurring, e.g. May 31)
     - GRACE_PERIOD_MONTHS
   Save → API call with 403 check
   ```

4. **DashboardHome**
   ```
   Top section:
     - Active lots count, Stale lots count, Total outstanding

   Collections Follow-up (if daysOutstanding > FOLLOW_UP_OUTSTANDING_DAYS):
     - List of customers, outstanding amount, action button

   Recent deliveries (last 10)
   ```

---

### Mobile (React Native) Considerations

- **Delivery form**: Mobile-first (camera for photo proof optional)
- **Customer lookup**: Searchable dropdown with phone sync
- **Offline**: Cache lots locally, sync on next connection
- **Role enforcement**: Same as web (backend validates)

---

## PART 5: IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)

- [ ] Database migration: Add `status` ENUM to Lots
- [ ] Database migration: Add `staleDaysLimit` to Products
- [ ] Database migration: Create WarehouseSettings table
- [ ] Database migration: Create LotStatusHistory table
- [ ] Supabase schema + RLS policies (role-based access)
- [ ] Audit logging infrastructure

### Phase 2: Core Accrual & Status (Weeks 3-4)

- [ ] API: POST /api/lots → create with status=ACTIVE
- [ ] API: GET /api/lots/:id → include daysOld, daysUntilStale, isStale, outstanding
- [ ] Job: Daily stale check (Supabase Edge Function)
- [ ] API: POST /api/lots/:id/written-off (owner only)
- [ ] API: POST /api/lots/:id/disputed (owner only)
- [ ] Frontend: Lot list with status badges + spoilage indicator

### Phase 3: Delivery Validation (Weeks 5-6)

- [ ] API: POST /api/lots/:id/delivery (with blocking logic)
- [ ] API: POST /api/lots/:id/delivery/override (with audit)
- [ ] Frontend: DeliveryModal with cases A/B
- [ ] Notification: Ownere alert on override
- [ ] 7-day audit flag: If delivery overridden but no payment within 7 days

### Phase 4: Payments & Collections (Weeks 7-8)

- [ ] API: GET /api/customers/:id/outstanding
- [ ] API: POST /api/customers/:id/receipts (auto-allocate FIFO)
- [ ] API: POST /api/customers/:id/receipts/:id/reallocate
- [ ] Frontend: Payment form + allocation UI
- [ ] Frontend: Collections follow-up list (outstanding > 30 days)

### Phase 5: Admin & Settings (Week 9)

- [ ] API: GET/POST /api/warehouse-settings/:warehouseID
- [ ] Frontend: SettingsPanel (OWNER only, avatar menu)
- [ ] Frontend: Dashboard home tab
- [ ] Role-based UI: Hide/show features per role

### Phase 6: Testing & Hardening (Weeks 10-11)

- [ ] E2E tests: Lot creation → delivery → payment → cleared
- [ ] E2E tests: Final delivery blocked scenario
- [ ] E2E tests: Owner override + 7-day audit
- [ ] Load test: 1000+ lots per warehouse
- [ ] Mobile testing: React Native delivery form

### Phase 7: Deployment & Monitoring (Week 12)

- [ ] Staging deployment
- [ ] Production deployment
- [ ] Monitoring: Supabase logs + Sentry
- [ ] Runbook for stale job failures

---

## PART 6: CRITICAL DECISIONS & ASSUMPTIONS

### Assumption 1: Stale is Automatic, Not Actionable
**What**: STALE status auto-triggers via daily job.
**Why**: Owner shouldn't have to manually mark lots as old.
**Risk**: If job fails, lots won't be marked. Mitigation: Alert on job failure, manual override via API.

### Assumption 2: Delivery Blocking is Hard for Final Deliveries
**What**: Cannot deliver final bags if outstanding > 0 (unless owner overrides).
**Why**: Stock is primary leverage; final delivery is last leverage point.
**Risk**: Legal challenge if customer claims undue withholding.
**Mitigation**: Clear T&C, audit trail, 60-day max hold policy (not in v1, but add later).

### Assumption 3: Payment Allocation is FIFO by Default
**What**: Oldest unpaid rent/charges paid first.
**Why**: Standard accounting practice, transparent to customer.
**Risk**: Customer might want custom allocation (e.g., pay specific lot only).
**Mitigation**: Manual reallocation available to OWNER (and MANAGER where policy allows).

### Assumption 4: Accrual Continues in STALE Status
**What**: Rent keeps accruing even if lot is STALE.
**Why**: Bags still occupy shelf, customer still owes storage.
**Risk**: Confusion with status name. STALE ≠ "stop charging".
**Mitigation**: Clear UI labels + documentation.

---

## PART 7: RED FLAGS & GUARDRAILS

### Red Flag 1: Delivery Blocking Without Legal Backing
**Issue**: Withholding final delivery as leverage could be deemed unlawful lien in some jurisdictions.
**Guardrail**:
- Add to warehouse T&C: "Final delivery will be withheld if customer outstanding > 0"
- Require customer signature at onboarding
- Keep audit trail (already planned)

### Red Flag 2: Stale Job Failures Go Unnoticed
**Issue**: If daily stale check fails silently, old lots never marked STALE.
**Guardrail**:
- Job must log every execution (success/failure)
- Alert if job doesn't run for 2+ days
- Dashboard shows "Last stale check: [timestamp]"

### Red Flag 3: Owner Override Without Accountability
**Issue**: Owner could override for coercive/unfair reasons.
**Guardrail**:
- Mandatory reason field
- Immediate owner notification
- 7-day payment audit flag
- Monthly report: "Overrides without subsequent payment"

### Red Flag 4: Role-Based Access Not Enforced Consistently
**Issue**: Frontend hides features, but backend doesn't validate role.
**Guardrail**:
- Every mutation endpoint checks `user.role`
- Return 403 if role doesn't match
- Log authorization failures

### Red Flag 5: Spoilage Limit Not Set for New Products
**Issue**: Product added without staleDaysLimit → defaults to BLANKET_STALE_DAYS (180 days).
**Guardrail**:
- Product creation form requires staleDaysLimit
- Owner dashboard warns: "Products without spoilage limit: [list]"
- Default: 180 days, but flag for review

---

## PART 8: CONFIGURATION & DEFAULTS

### WarehouseSettings Defaults
```
BLANKET_STALE_DAYS = 180 days
FOLLOW_UP_OUTSTANDING_DAYS = 30 days
YEARLY_RENT_CUTOFF_MONTH / YEARLY_RENT_CUTOFF_DAY = Jan 1 (month 1, day 1) unless configured otherwise (e.g. 5 / 31 = May 31)
GRACE_PERIOD_MONTHS = 1 month
```

### Product Spoilage Limits (Reference)
```
Potato: 180 days
Onion: 60 days
Carrot: 120 days
Garlic: 90 days
(Configure per warehouse)
```

---

## PART 9: ERROR CODES & RESPONSES

### 409 Conflict (Final Delivery Blocked)
```json
{
  "error": "Cannot deliver final bags",
  "code": "FINAL_DELIVERY_BLOCKED",
  "outstanding": 15000,
  "currency": "INR",
  "canOverride": true,
  "requiresApproval": false
}
```

### 403 Forbidden (Unauthorized Action)
```json
{
  "error": "User not authorized",
  "code": "UNAUTHORIZED_ROLE",
  "requiredRole": "OWNER",
  "userRole": "MANAGER",
  "action": "written_off"
}
```

### 200 OK with Warning (Normal Delivery with Outstanding)
```json
{
  "success": true,
  "warning": "Customer has outstanding payment",
  "outstanding": 15000,
  "canProceed": true,
  "deliveryID": "del_123"
}
```

---

## PART 10: MONITORING & OBSERVABILITY

### Key Metrics
- Avg days to clear a lot
- % of lots reaching STALE
- % of deliveries blocked by outstanding
- % of owner overrides
- Audit trail: Changes per lot, per day

### Dashboards (Observability)
1. **Operations**: Active/Stale/Delivered lots, recent deliveries
2. **Collections**: Outstanding by customer, follow-ups due, cleared lots
3. **Audit**: All status changes, overrides, writes-off, disputes

### Alerts
- Stale job failed (last 2 days)
- Owner override without subsequent payment (7 days)
- Lots stuck in DISPUTED for 30+ days
- Collections follow-up due (send daily)

---

## APPENDIX: GLOSSARY

- **Lot**: A shipment of product from customer, identified by lodgement date + product + customer
- **Balance Bags**: Current count of bags still in warehouse (starts = originalBags, decreases with deliveries)
- **Outstanding**: Unpaid rent + handling charges for a customer (across all lots)
- **Stale**: Lot age exceeds product spoilage limit (auto-triggered daily)
- **FIFO**: First-In-First-Out payment allocation (oldest charges paid first)
- **Hamali**: Manual labor charge per bag
- **KataCoolie**: Weight-based handling charge
- **Mamulle**: Miscellaneous charge

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 18, 2026 | CTO initial spec: Status enum, stale detection, delivery blocking, payment logic |

