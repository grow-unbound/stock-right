# Cold Storage MVP: Detailed API & Database Schema

**Status**: Ready for backend development  
**Database**: Supabase PostgreSQL  
**API surface**: **Supabase only for MVP** — PostgREST, RLS, Auth, Storage, Edge Functions (cron/jobs). No separate Node/Express/Hono server unless product later requires it. REST paths in Part 2 describe **logical operations** (implement as RPC, Edge Functions, or direct table access under RLS).

**Identity**: **`auth.users`** is the golden source for sign-in (phone). App tables use **`public.user_profiles`** (`id` = `auth.users.id`) and **`public.user_roles`** (`user_id`, `tenant_id`, `role`) for tenant membership. **No email** in domain tables.

**Roles (canonical)**: `OWNER`, `MANAGER`, `STAFF`. 

**RLS / triggers**: Resolve tenant from the **logged-in user** via `public.current_tenant_id()` (backed by `user_roles`). Prefer **joins** `warehouse_id` → `warehouses.tenant_id` and **`DEFAULT current_tenant_id()`** on `tenant_id` columns where needed; **avoid** a large set of `BEFORE INSERT` stamp triggers.

**DB naming**: Implement schema in **snake_case**; this document still shows some historical camelCase in fragments — migrate names when writing SQL (e.g. `warehouse_id`, `created_at`).

---

## PART 1: DATABASE SCHEMA (COMPLETE)

### 1.1 ENUM Types (PostgreSQL)

```sql
-- Lot Status
CREATE TYPE lot_status AS ENUM (
  'ACTIVE',
  'STALE',
  'DELIVERED',
  'CLEARED',
  'WRITTEN_OFF',
  'DISPUTED'
);

-- User Roles (canonical)
CREATE TYPE user_role AS ENUM (
  'OWNER',
  'MANAGER',
  'STAFF'
);

-- Rental Modes
CREATE TYPE rental_mode AS ENUM (
  'YEARLY',
  'MONTHLY',
  'BROUGHT_FORWARD'
);

-- Charge Types
CREATE TYPE charge_type AS ENUM (
  'HAMALI',           -- Manual labor per bag
  'PLATFORM',         -- Transaction fee
  'KATA_COOLIE',      -- Weight-based handling
  'MAMULLE'           -- Miscellaneous
);

-- Payment Methods
CREATE TYPE payment_method AS ENUM (
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'UPI',
  'OTHER'
);
```

---

### 1.2 Core Tables

#### 1. Warehouses
```sql
CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenantID UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Multi-tenant: every warehouse belongs to one business (tenant)
  warehouseName TEXT NOT NULL,
  warehouseCode TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT,
  managerName TEXT,
  managerPhone TEXT,
  address TEXT,
  capacity_bags INT DEFAULT 10000,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_warehouses_city ON warehouses(city);
CREATE INDEX idx_warehouses_warehouseCode ON warehouses(warehouseCode);
```

#### 2. Customers
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouseID UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  customerName TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  gstin TEXT,
  creditLimit DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customers_warehouseID ON customers(warehouseID);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE UNIQUE INDEX idx_customers_unique_phone_warehouse
  ON customers(warehouseID, phone);
```

#### 3. Products
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productName TEXT NOT NULL,
  productGroupID UUID,
  staleDaysLimit INT,
    -- e.g., 180 for potato, 60 for onion
    -- NULL = use warehouse BLANKET_STALE_DAYS
  storageTemperature TEXT,
    -- e.g., "0-4°C", "15-18°C"
  description TEXT,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_productGroupID ON products(productGroupID);
CREATE INDEX idx_products_isActive ON products(isActive);

-- ADD CONSTRAINT: staleDaysLimit must be >= 1 if not NULL
ALTER TABLE products
  ADD CONSTRAINT products_staleDaysLimit_check
  CHECK (staleDaysLimit IS NULL OR staleDaysLimit > 0);
```

#### 4. Lots (CORE)
```sql
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouseID UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  customerID UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  productID UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Bags & Stock
  originalBags INT NOT NULL,
  balanceBags INT NOT NULL,
    -- Starts = originalBags, decreases with deliveries

  -- Dates
  lodgementDate DATE NOT NULL,
    -- When stock entered warehouse

  -- Rental
  rentalMode rental_mode NOT NULL,
  rentalAmount DECIMAL(12,2) NOT NULL,

  -- Status
  status lot_status DEFAULT 'ACTIVE',

  -- Flags
  chargesFrozen BOOLEAN DEFAULT false,
    -- If true, don't accrue new rent
    -- Set to true when status = WRITTEN_OFF or DISPUTED (optional)

  notes TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (CRITICAL for queries)
CREATE INDEX idx_lots_warehouseID_status
  ON lots(warehouseID, status);
CREATE INDEX idx_lots_customerID
  ON lots(customerID);
CREATE INDEX idx_lots_productID
  ON lots(productID);
CREATE INDEX idx_lots_lodgementDate
  ON lots(lodgementDate);
CREATE INDEX idx_lots_status
  ON lots(status);

-- Constraints
ALTER TABLE lots
  ADD CONSTRAINT lots_balanceBags_check
  CHECK (balanceBags >= 0 AND balanceBags <= originalBags);
```

#### 5. RentAccruals
```sql
CREATE TABLE rent_accruals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lotID UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,

  accrualDate DATE NOT NULL,
    -- Date rent accrued (e.g., Feb 1 for first monthly, Jan 1 for yearly)

  rentalAmount DECIMAL(12,2) NOT NULL,
  rentalMode rental_mode NOT NULL,

  -- Payment tracking
  isPaid BOOLEAN DEFAULT false,
  paidDate DATE,

  notes TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rentAccruals_lotID ON rent_accruals(lotID);
CREATE INDEX idx_rentAccruals_isPaid ON rent_accruals(isPaid);
CREATE INDEX idx_rentAccruals_accrualDate ON rent_accruals(accrualDate);

-- Constraint
ALTER TABLE rent_accruals
  ADD CONSTRAINT rentAccruals_paidDate_check
  CHECK ((isPaid = false AND paidDate IS NULL)
         OR (isPaid = true AND paidDate IS NOT NULL));
```

#### 6. TransactionCharges
```sql
CREATE TABLE transaction_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliveryID UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  lotID UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,

  chargeType charge_type NOT NULL,
  chargeAmount DECIMAL(12,2) NOT NULL,
  ratePerUnit DECIMAL(12,4),
    -- e.g., ₹50 per bag (Hamali), ₹2 per quintal (KataCoolie)

  -- Payment tracking
  isPaid BOOLEAN DEFAULT false,
  paidDate DATE,

  notes TEXT,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactionCharges_deliveryID
  ON transaction_charges(deliveryID);
CREATE INDEX idx_transactionCharges_lotID
  ON transaction_charges(lotID);
CREATE INDEX idx_transactionCharges_isPaid
  ON transaction_charges(isPaid);
CREATE INDEX idx_transactionCharges_chargeType
  ON transaction_charges(chargeType);

-- Constraint
ALTER TABLE transaction_charges
  ADD CONSTRAINT transactionCharges_paidDate_check
  CHECK ((isPaid = false AND paidDate IS NULL)
         OR (isPaid = true AND paidDate IS NOT NULL));
```

#### 7. Deliveries
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lotID UUID NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,

  -- Delivery Details
  numBagsOut INT NOT NULL,
  deliveryDate DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'COMPLETED',
    -- COMPLETED, BLOCKED, OVERRIDDEN

  -- Blocking Info
  blockedReason TEXT,
    -- If status = BLOCKED, reason why

  -- Override Info
  overriddenBy UUID REFERENCES user_profiles(id),
  overrideReason TEXT,
  overrideAt TIMESTAMPTZ,

  -- Context
  deliveryNotes TEXT,

  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deliveries_lotID ON deliveries(lotID);
CREATE INDEX idx_deliveries_deliveryDate ON deliveries(deliveryDate);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- Constraint
ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_numBagsOut_check
  CHECK (numBagsOut > 0);
```

#### 8. CustomerReceipts
```sql
CREATE TABLE customer_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customerID UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  warehouseID UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  -- Receipt Details
  receiptDate DATE NOT NULL,
  totalAmount DECIMAL(12,2) NOT NULL,
  paymentMethod payment_method,

  -- Metadata
  referenceNumber TEXT,
    -- e.g., Cheque number, UPI ref
  notes TEXT,

  -- Recording
  recordedBy UUID REFERENCES user_profiles(id),

  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customerReceipts_customerID
  ON customer_receipts(customerID);
CREATE INDEX idx_customerReceipts_warehouseID
  ON customer_receipts(warehouseID);
CREATE INDEX idx_customerReceipts_receiptDate
  ON customer_receipts(receiptDate);
```

#### 9. ReceiptAllocations
```sql
CREATE TABLE receipt_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiptID UUID NOT NULL REFERENCES customer_receipts(id) ON DELETE CASCADE,

  -- Can allocate to either rent or charge (mutually exclusive)
  rentAccrualID UUID REFERENCES rent_accruals(id) ON DELETE CASCADE,
  chargeID UUID REFERENCES transaction_charges(id) ON DELETE CASCADE,

  amount DECIMAL(12,2) NOT NULL,

  -- Metadata
  allocatedBy UUID REFERENCES user_profiles(id),
  allocatedManually BOOLEAN DEFAULT false,
    -- false = auto-allocated FIFO, true = manual allocation

  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_receiptAllocations_receiptID
  ON receipt_allocations(receiptID);
CREATE INDEX idx_receiptAllocations_rentAccrualID
  ON receipt_allocations(rentAccrualID);
CREATE INDEX idx_receiptAllocations_chargeID
  ON receipt_allocations(chargeID);

-- Constraint: Can't allocate to both rent AND charge
ALTER TABLE receipt_allocations
  ADD CONSTRAINT receiptAllocations_xor_check
  CHECK (
    (rentAccrualID IS NOT NULL AND chargeID IS NULL)
    OR (rentAccrualID IS NULL AND chargeID IS NOT NULL)
  );
```

#### 10. Tenants, User profiles & roles (replaces single `users` table)

**`tenants`** — root business entity (add before `warehouses` in migrations):

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`warehouses`** — add `tenantID` (or `tenant_id` in snake_case SQL) FK → `tenants`.

**`user_profiles`** — one row per `auth.users` id (phone identity; no email):

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`user_roles`** — tenant membership + single role per tenant row:

```sql
CREATE TABLE user_roles (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  PRIMARY KEY (user_id, tenant_id)
);
```

**`user_warehouse_assignments`** — which warehouses a user may access:

```sql
CREATE TABLE user_warehouse_assignments (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, warehouse_id)
);
```

**MVP**: typically one `user_roles` row per user. Multi-tenant users need a defined `active_tenant_id` (or equivalent) before `current_tenant_id()` can stay unambiguous.

```sql
-- Indexes (snake_case in real migrations)
CREATE INDEX idx_user_profiles_phone ON user_profiles(phone);
CREATE INDEX idx_user_roles_tenant ON user_roles(tenant_id);
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
```

#### 11. AuditLog
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouseID UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  -- Actor
  userID UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Action Details
  entityType TEXT NOT NULL,
    -- e.g., 'LOT', 'DELIVERY', 'RECEIPT', 'SETTINGS'
  entityID UUID,

  action TEXT NOT NULL,
    -- e.g., 'LOT_STATUS_CHANGED', 'DELIVERY_BLOCKED', 'OVERRIDE_APPROVED'

  -- Old/New Values
  oldValues JSONB,
  newValues JSONB,

  -- Context
  reason TEXT,
  ipAddress INET,

  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (CRITICAL for compliance)
CREATE INDEX idx_auditLog_warehouseID_createdAt
  ON audit_log(warehouseID, createdAt DESC);
CREATE INDEX idx_auditLog_entityType_entityID
  ON audit_log(entityType, entityID);
CREATE INDEX idx_auditLog_userID
  ON audit_log(userID);
CREATE INDEX idx_auditLog_action
  ON audit_log(action);
```

#### 12. LotStatusHistory (for traceability)
```sql
CREATE TABLE lot_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lotID UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,

  -- Transition
  oldStatus lot_status,
  newStatus lot_status NOT NULL,

  -- Context
  reason TEXT,
    -- e.g., "Auto: exceeded staleDaysLimit (180)"
    -- e.g., "Owner marked as loss"
    -- e.g., "Final delivery completed"

  changedBy UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  createdAt TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_lotStatusHistory_lotID
  ON lot_status_history(lotID);
CREATE INDEX idx_lotStatusHistory_createdAt
  ON lot_status_history(createdAt DESC);
CREATE INDEX idx_lotStatusHistory_newStatus
  ON lot_status_history(newStatus);
```

#### 13. WarehouseSettings (NEW)
```sql
CREATE TABLE warehouse_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouseID UUID UNIQUE NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,

  -- Spoilage
  BLANKET_STALE_DAYS INT DEFAULT 180,
    -- Default spoilage limit if product.staleDaysLimit = NULL

  -- Collections
  FOLLOW_UP_OUTSTANDING_DAYS INT DEFAULT 30,
    -- Trigger follow-up when daysOutstanding > this

  -- Rental Cutoff (recurring calendar month/day every year — no stored year)
  YEARLY_RENT_CUTOFF_MONTH SMALLINT NOT NULL DEFAULT 1,  -- 1–12 (e.g. 5 = May)
  YEARLY_RENT_CUTOFF_DAY SMALLINT NOT NULL DEFAULT 1,    -- 1–31, clamped to last day of month when needed

  GRACE_PERIOD_MONTHS INT DEFAULT 1,
    -- Grace period before cutoff (e.g., 1 month = can pay Jan 1-31)

  -- System
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ DEFAULT NOW()
);

-- Constraints
ALTER TABLE warehouse_settings
  ADD CONSTRAINT ws_stale_days_check
  CHECK (BLANKET_STALE_DAYS > 0);
ALTER TABLE warehouse_settings
  ADD CONSTRAINT ws_followup_days_check
  CHECK (FOLLOW_UP_OUTSTANDING_DAYS > 0);
ALTER TABLE warehouse_settings
  ADD CONSTRAINT ws_grace_months_check
  CHECK (GRACE_PERIOD_MONTHS > 0);
```

---

### 1.3 Row-Level Security (RLS) Policies

Implement helpers in **`public`** (example names):

- `public.current_tenant_id()` — from `user_roles` for `auth.uid()` (MVP: single row per user).
- `public.accessible_warehouse_ids()` — from `user_warehouse_assignments`.

Prefer **joining `warehouses.tenant_id`** on `warehouse_id` instead of many `BEFORE INSERT` triggers. See `.cursor/rules/supabase_multitenancy.mdc` for full patterns.

#### Warehouses Table
```sql
-- User sees warehouses in their tenant and assignment list
CREATE POLICY "warehouses_select" ON warehouses
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND id IN (SELECT public.accessible_warehouse_ids())
  );

-- OWNER or MANAGER can update warehouse metadata (tune per product)
CREATE POLICY "warehouses_update" ON warehouses
  FOR UPDATE
  USING (
    tenant_id = public.current_tenant_id()
    AND id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role IN ('OWNER', 'MANAGER')
    )
  );
```

#### Lots Table
```sql
CREATE POLICY "lots_select" ON lots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = lots.warehouseID
        AND w.tenant_id = public.current_tenant_id()
    )
    AND lots.warehouseID IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY "lots_insert" ON lots
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = lots.warehouseID
        AND w.tenant_id = public.current_tenant_id()
    )
    AND lots.warehouseID IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role IN ('OWNER', 'MANAGER')
    )
  );
```

#### WarehouseSettings Table
```sql
-- OWNER only
CREATE POLICY "warehouse_settings_owner" ON warehouse_settings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM warehouses w
      WHERE w.id = warehouse_settings.warehouseID
        AND w.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role = 'OWNER'
    )
  );
```

---

## PART 2: REST API ENDPOINTS

### Authentication
All endpoints require:
```
Authorization: Bearer <JWT_TOKEN_FROM_SUPABASE>
Content-Type: application/json
```

---

### LOT MANAGEMENT

#### **GET /api/lots**
Fetch lots with filtering & pagination.

**Query Parameters**:
```
warehouseID: UUID (required)
status: lot_status (optional, can repeat: ?status=ACTIVE&status=STALE)
customerID: UUID (optional)
sortBy: 'lodgementDate' | 'balanceBags' | 'outstanding' (default: lodgementDate DESC)
limit: INT (default: 50, max: 500)
offset: INT (default: 0)
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "lot_123",
      "warehouseID": "wh_1",
      "customerID": "cust_1",
      "customerName": "ABC Traders",
      "productID": "prod_potato",
      "productName": "Potato",
      "originalBags": 1000,
      "balanceBags": 750,
      "lodgementDate": "2026-01-15",
      "status": "ACTIVE",
      "rentalMode": "MONTHLY",
      "rentalAmount": 5000,

      "daysOld": 34,
      "staleDaysLimit": 180,
      "daysUntilStale": 146,
      "isStale": false,
      "spoilageRiskLevel": "green",

      "outstanding": 0,
      "daysOutstanding": null,
      "unpaidRents": [],
      "unpaidCharges": [],

      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-02-18T14:00:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 245
  }
}
```

**Role Filtering**:
- MANAGER: Only ACTIVE + STALE lots
- OWNER: All lots

---

#### **GET /api/lots/:id**
Fetch full lot details.

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "lot_123",
    "warehouseID": "wh_1",
    "customerID": "cust_1",
    "customerName": "ABC Traders",
    "customerPhone": "+91-9999999999",
    "productID": "prod_potato",
    "productName": "Potato",
    "originalBags": 1000,
    "balanceBags": 750,
    "lodgementDate": "2026-01-15",
    "status": "ACTIVE",
    "rentalMode": "MONTHLY",
    "rentalAmount": 5000,
    "chargesFrozen": false,

    "daysOld": 34,
    "staleDaysLimit": 180,
    "daysUntilStale": 146,
    "isStale": false,
    "spoilageRiskLevel": "green",

    "outstanding": 0,
    "daysOutstanding": null,

    "rentAccruals": [
      {
        "id": "ra_1",
        "accrualDate": "2026-02-15",
        "rentalAmount": 5000,
        "isPaid": false,
        "paidDate": null
      }
    ],

    "deliveries": [
      {
        "id": "del_1",
        "numBagsOut": 250,
        "deliveryDate": "2026-02-10",
        "status": "COMPLETED",
        "charges": [
          {
            "id": "ch_1",
            "chargeType": "HAMALI",
            "chargeAmount": 5000,
            "isPaid": false
          }
        ]
      }
    ],

    "statusHistory": [
      {
        "newStatus": "ACTIVE",
        "reason": "Lot created",
        "changedBy": "user_123",
        "createdAt": "2026-01-15T10:00:00Z"
      }
    ],

    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-02-18T14:00:00Z"
  }
}
```

---

#### **POST /api/lots**
Create new lot.

**Role**: OWNER

**Body**:
```json
{
  "warehouseID": "wh_1",
  "customerID": "cust_1",
  "productID": "prod_potato",
  "originalBags": 1000,
  "lodgementDate": "2026-01-15",
  "rentalMode": "MONTHLY",
  "rentalAmount": 5000,
  "notes": "Good quality, cold storage at -2°C"
}
```

**Response**: 201 Created
```json
{
  "success": true,
  "data": {
    "id": "lot_123",
    "status": "ACTIVE",
    "balanceBags": 1000,
    "createdAt": "2026-02-18T14:00:00Z"
  }
}
```

**Validation**:
- `originalBags > 0`
- `rentalAmount > 0`
- `lodgementDate` ≤ TODAY
- Product exists

---

#### **POST /api/lots/:id/delivery**
Record delivery transaction with blocking logic.

**Role**: MANAGER, OWNER

**Body**:
```json
{
  "numBagsOut": 100,
  "deliveryNotes": "Delivered to customer site"
}
```

**Response Cases**:

**Case A: Normal Delivery (not final)**
```json
{
  "success": true,
  "status": 200,
  "warning": "Customer outstanding ₹15000. Confirm delivery?",
  "canProceed": true,
  "outstanding": 15000,
  "deliveryID": "del_123",
  "balanceBagsAfter": 650
}
```

**Case B: Final Delivery Blocked**
```json
{
  "success": false,
  "status": 409,
  "error": "Cannot deliver final bags",
  "code": "FINAL_DELIVERY_BLOCKED",
  "outstanding": 15000,
  "currency": "INR",
  "canOverride": true,
  "requiresApproval": false,
  "message": "Customer has outstanding ₹15000. Contact owner to override."
}
```

**Logic**:
```
isFinalDelivery = (balanceBags - numBagsOut) === 0

if isFinalDelivery:
  if customer.outstanding > 0:
    return 409 BLOCKED
  else:
    proceed → update lot status to DELIVERED

if !isFinalDelivery:
  if customer.outstanding > 0:
    return 200 with warning + canProceed: true
  else:
    proceed silently
```

---

#### **POST /api/lots/:id/delivery/override**
Owner override for blocked final delivery.

**Role**: OWNER only (403 if not owner)

**Body**:
```json
{
  "overrideReason": "Payment received OTC, customer cleared"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "message": "Delivery approved",
  "deliveryID": "del_123",
  "auditLogID": "al_456",
  "notificationSent": true
}
```

**Audit**:
- Log to `audit_log`: action = "DELIVERY_OVERRIDE", reason = overrideReason
- Notify all OWNER users: "[Owner Name] overrode delivery block for Lot [ID]"
- Flag for 7-day audit: "If not paid within 7 days, alert"

---

#### **POST /api/lots/:id/write-off**
Mark lot as loss (owner action).

**Role**: OWNER only (403 if not owner)

**Body**:
```json
{
  "reason": "Stock spoiled due to refrigeration failure"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "lot_123",
    "status": "WRITTEN_OFF",
    "chargesFrozen": true,
    "updatedAt": "2026-02-18T14:00:00Z"
  }
}
```

**Side Effects**:
- Set `status = WRITTEN_OFF`
- Set `chargesFrozen = true` (stop accruing new charges)
- Log to `lot_status_history`
- Log to `audit_log`

---

#### **POST /api/lots/:id/mark-disputed**
Mark lot as under negotiation (owner action).

**Role**: OWNER only (403 if not owner)

**Body**:
```json
{
  "reason": "Customer claims shortage, investigating"
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "id": "lot_123",
    "status": "DISPUTED",
    "updatedAt": "2026-02-18T14:00:00Z"
  }
}
```

**Side Effects**:
- Set `status = DISPUTED`
- Continue accruing rent (owner can manually freeze if needed)
- Log to `lot_status_history`

---

### PAYMENT & COLLECTIONS

#### **GET /api/customers/:id/outstanding**
Get customer outstanding balance.

**Response**:
```json
{
  "success": true,
  "data": {
    "customerID": "cust_1",
    "customerName": "ABC Traders",
    "totalOutstanding": 45000,
    "daysOutstanding": 34,
    "followUpRequired": true,

    "unpaidRents": [
      {
        "id": "ra_1",
        "lotID": "lot_123",
        "accrualDate": "2026-02-15",
        "rentalAmount": 5000,
        "rentalMode": "MONTHLY"
      }
    ],

    "unpaidCharges": [
      {
        "id": "ch_1",
        "deliveryID": "del_1",
        "chargeType": "HAMALI",
        "chargeAmount": 5000
      }
    ]
  }
}
```

---

#### **POST /api/customers/:id/receipts**
Record payment receipt (auto-allocates FIFO).

**Body**:
```json
{
  "receiptDate": "2026-02-18",
  "totalAmount": 45000,
  "paymentMethod": "BANK_TRANSFER",
  "referenceNumber": "TXN123456",
  "notes": "Payment received from customer"
}
```

**Response**: 201 Created
```json
{
  "success": true,
  "data": {
    "receiptID": "rec_1",
    "totalAmount": 45000,
    "allocations": [
      {
        "id": "al_1",
        "rentAccrualID": "ra_1",
        "amount": 5000,
        "allocatedManually": false
      },
      {
        "id": "al_2",
        "chargeID": "ch_1",
        "amount": 5000,
        "allocatedManually": false
      }
    ],
    "remainingAmount": 0
  }
}
```

**Logic**:
- Sort unpaid or partially paid items (rents + charges) by date (FIFO)
- Auto-allocate receipt amount to oldest items
- If remainder, allocate partially to the next unpaid item
- Mark settled items (rents+charges) in accruals tables as well

---

#### **POST /api/customers/:id/receipts/:id/reallocate**
Manually re-allocate receipt to different charges.

**Role**: OWNER

**Body**:
```json
{
  "allocations": [
    { "rentAccrualID": "ra_2", "amount": 10000 },
    { "chargeID": "ch_3", "amount": 8000 },
    { "chargeID": "ch_4", "amount": 27000 }
  ]
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "receiptID": "rec_1",
    "allocations": [
      { "id": "al_new_1", "rentAccrualID": "ra_2", "amount": 10000 },
      { "id": "al_new_2", "chargeID": "ch_3", "amount": 8000 },
      { "id": "al_new_3", "chargeID": "ch_4", "amount": 27000 }
    ]
  }
}
```

**Validation**:
- Total allocations = receipt.totalAmount
- All items exist and belong to same customer
- Log old allocation + new allocation for audit

---

### WAREHOUSE SETTINGS

#### **GET /api/warehouse-settings/:warehouseID**

**Role**: OWNER only (others get 403)

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "ws_1",
    "warehouseID": "wh_1",
    "BLANKET_STALE_DAYS": 180,
    "FOLLOW_UP_OUTSTANDING_DAYS": 30,
    "YEARLY_RENT_CUTOFF_MONTH": 5,
    "YEARLY_RENT_CUTOFF_DAY": 31,
    "GRACE_PERIOD_MONTHS": 1,
    "updatedAt": "2026-01-01T00:00:00Z"
  }
}
```

---

#### **POST /api/warehouse-settings/:warehouseID**

**Role**: OWNER only (403 if not owner)

**Body**:
```json
{
  "BLANKET_STALE_DAYS": 180,
  "FOLLOW_UP_OUTSTANDING_DAYS": 30,
  "YEARLY_RENT_CUTOFF_MONTH": 5,
  "YEARLY_RENT_CUTOFF_DAY": 31,
  "GRACE_PERIOD_MONTHS": 1
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": { /* updated settings */ }
}
```

---

### DASHBOARD & ANALYTICS

#### **GET /api/dashboard/home**

**Role**: All roles

**Response**:
```json
{
  "success": true,
  "data": {
    "warehouseID": "wh_1",

    "summary": {
      "activeLotsCount": 125,
      "staleLotsCount": 8,
      "deliveredLotsCount": 45,
      "clearedLotsCount": 230,
      "totalActiveStorage": 8500,
      "totalOutstandingAmount": 125000
    },

    "collectionsFollowUpDue": [
      {
        "customerID": "cust_1",
        "customerName": "ABC Traders",
        "outstanding": 15000,
        "daysOutstanding": 45,
        "daysOverFollowUpThreshold": 15,
        "lastFollowUpDate": "2026-02-10"
      }
    ],

    "recentDeliveries": [
      {
        "id": "del_1",
        "lotID": "lot_123",
        "customerName": "ABC Traders",
        "numBagsOut": 100,
        "deliveryDate": "2026-02-18",
        "blocked": false,
        "overridden": false
      }
    ],

    "deliveriesBlockedToday": 2,
    "deliveriesOverriddenThisMonth": 1
  }
}
```

---

#### **GET /api/dashboard/stock**

**Role**: All roles (filtered by role permissions)

**Response**:
```json
{
  "success": true,
  "data": {
    "lots": [
      {
        "id": "lot_123",
        "customerName": "ABC Traders",
        "warehouseName": "Padala Store",
        "productName": "Potato",
        "balanceBags": 750,
        "daysOld": 34,
        "daysUntilStale": 146,
        "spoilageRiskLevel": "green",
        "status": "ACTIVE",
        "outstanding": 0,
        "lastDeliveryDate": "2026-02-10"
      }
    ]
  }
}
```

---

### JOBS (Internal Endpoints)

#### **POST /api/jobs/daily-stale-check**
Internal endpoint, called by Supabase Cron.

**Authentication**: Service Role Key (not user token)

**Body**:
```json
{
  "warehouseID": null
}
```

**Response**: 200 OK
```json
{
  "success": true,
  "data": {
    "timestamp": "2026-02-18T00:00:00Z",
    "warehousesProcessed": 5,
    "lotsMarkedStale": 12,
    "logs": [
      {
        "lotID": "lot_123",
        "oldStatus": "ACTIVE",
        "newStatus": "STALE",
        "reason": "Exceeded staleDaysLimit (180 days)",
        "daysOld": 181
      }
    ]
  }
}
```

**Implementation**:
```
FOR EACH warehouse (or specific if provided):
  FOR EACH lot WHERE status = ACTIVE OR STALE:
    daysOld = TODAY - lot.lodgementDate
    staleDaysLimit = product.staleDaysLimit OR warehouse_settings.BLANKET_STALE_DAYS

    IF daysOld > staleDaysLimit AND lot.status != STALE:
      UPDATE lot SET status = STALE
      INSERT INTO lot_status_history (lotID, oldStatus, newStatus, reason)
      LOG to audit_log

    IF daysOld <= staleDaysLimit AND lot.status = STALE:
      # Optional: Move back to ACTIVE if product limit increased
      # For v1, keep STALE once marked
```

---

## PART 3: CALCULATIONS & FORMULAS

### Outstanding Balance
```
outstanding = SUM(rent_accruals.rentalAmount WHERE isPaid = false AND lotID IN customer_lots)
            + SUM(transaction_charges.chargeAmount WHERE isPaid = false AND lotID IN customer_lots)
```

### Days Outstanding
```
daysOutstanding = TODAY - MIN(lot.lodgementDate WHERE customer has unpaid items)
  OR NULL if no outstanding
```

### Follow-Up Trigger
```
followUpRequired = outstanding > 0
                   AND daysOutstanding > warehouse_settings.FOLLOW_UP_OUTSTANDING_DAYS
```

### Stale Status
```
isStale = (TODAY - lot.lodgementDate) > (product.staleDaysLimit OR warehouse_settings.BLANKET_STALE_DAYS)
```

### Days Until Stale
```
daysUntilStale = MAX(0, staleDaysLimit - daysOld)
```

### Spoilage Risk Level
```
IF daysUntilStale > 30:   "green"
IF daysUntilStale 10-30:  "yellow"
IF daysUntilStale < 10:   "red"
IF isStale:               "red" (STALE indicator)
```

---

## PART 4: ERROR CODES

| Code | HTTP | Message | Action |
|------|------|---------|--------|
| FINAL_DELIVERY_BLOCKED | 409 | Cannot deliver final bags | Show override form if owner |
| UNAUTHORIZED_ROLE | 403 | User not authorized for this action | Check role, suggest owner contact |
| INVALID_LOT_STATUS | 400 | Cannot perform this action on [STATUS] lot | Show status-specific guidance |
| INSUFFICIENT_BAGS | 400 | Cannot deliver more bags than available | Reduce numBagsOut |
| ALLOCATION_MISMATCH | 400 | Allocation total doesn't equal receipt amount | Correct allocations |
| SETTINGS_UPDATE_FAILED | 500 | Could not update settings | Retry or contact owner |

---

## PART 5: Indexes & Performance

**Critical Indexes Created**:
```
• lots(warehouseID, status) — For dashboard views
• lots(customerID) — For customer lot listing
• lots(lodgementDate) — For stale check job
• rent_accruals(lotID, isPaid) — For outstanding calc
• transaction_charges(lotID, isPaid) — For outstanding calc
• customer_receipts(customerID, receiptDate) — For payment history
• audit_log(warehouseID, createdAt DESC) — For compliance audit
```

**Expected Query Performance**:
- Get warehouse lots: < 100ms (1000+ lots)
- Calculate customer outstanding: < 50ms
- Record delivery: < 200ms (includes charge creation)
- Daily stale check job: ~500ms per 1000 lots

---

## APPENDIX: Database Initialization Script

See separate `init-database.sql` file.

