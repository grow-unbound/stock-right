# Postgres-only import: lots → transport charges → operational payments

This guide is the **end-to-end** path for warehouse data that lives in three places:

| Phase | Staging table | RPC / action | `public` targets |
|-------|----------------|--------------|------------------|
| **A** | `import_staging.raw_lots_and_deliveries` | `import_staging.apply_lots_from_raw` | `lots`, `deliveries`, `transaction_charges` (HAMALI, KATA_COOLIE, MAMULLE, PLATFORM_HAMALI only) |
| **B** | `import_staging.raw_lots_charges_paid` | `import_staging.apply_transport_charges_from_raw` | `transaction_charges` (**TRANSPORT** rows only) |
| **C** | `import_staging.op_import` | ad-hoc `INSERT` | `operational_payments` (staff/vendor lines from `operational-payments.csv`; `lot_id` / `delivery_id` usually NULL) |

**Order matters:** run **A → B → C**. Transport overlay (**B**) expects lots and deliveries (and non-transport charge batches) to already exist from **A**. The operational CSV (**C**) is logically separate from **A/B** except that you use the same tenant/warehouse.

It does **not** replace app-side record flows. Use a disposable DB or `BEGIN` / `ROLLBACK` until you trust the result.

**See also:** [`IMPORT_LOTS_STAGING.md`](IMPORT_LOTS_STAGING.md) for the canonical `\copy` column list for `lots-and-deliveries.csv` and more detail on `apply_lots_from_raw`.

---

## Prerequisites

1. **Migrations applied**, including:
   - `20260426120000_import_staging_lots_raw.sql` — `import_staging.raw_lots_and_deliveries`
   - `20260426120100_import_staging_apply_lots_from_raw.sql` — `parse_us_date`, `_trim_num`, `apply_lots_from_raw`
   - `20260430120000_import_staging_transport_charges_overlay.sql` — `import_staging.raw_lots_charges_paid`, `apply_transport_charges_from_raw`
2. **Reference data** for the target warehouse (same as lots doc): `customers`, `products`, `product_charges` + `charge_types` (including **TRANSPORT** per product for Phase B), `locations` as needed.
3. **`public.operational_payments`** + **`public.payment_types`** for Phase C (if your branch has not added these tables yet, skip Phase C until the schema exists).
4. Resolve **tenant** and **warehouse** UUIDs:

```sql
SELECT t.id AS tenant_id, w.id AS warehouse_id
FROM public.tenants t
JOIN public.warehouses w ON w.tenant_id = t.id
WHERE t.name = 'Sri Sai Cold Storage'
  AND w.warehouse_name ILIKE '%Padala%';
```

Replace filters with your real tenant/warehouse names.

---

## Step 0 — Apply migrations

From repo root:

```bash
pnpm db:reset
```

or:

```bash
pnpm --filter @growcold/supabase exec supabase db push
```

---

## Phase A — Lots & deliveries → `apply_lots_from_raw`

Follow [`IMPORT_LOTS_STAGING.md`](IMPORT_LOTS_STAGING.md) in full. Short form:

1. `TRUNCATE import_staging.raw_lots_and_deliveries;`
2. `\copy import_staging.raw_lots_and_deliveries (...)` from `data/lots-and-deliveries.csv` with the column order in that doc.
3. Run:

```sql
SELECT import_staging.apply_lots_from_raw(
  '<tenant_id>'::uuid,
  '<warehouse_id>'::uuid,
  false   -- true to TRUNCATE raw_lots_and_deliveries after success
);
```

This fills **`public.transaction_charges`** for the four bag-handling charge types. It does **not** insert **TRANSPORT** (same as `scripts/import-sri-sai-padala.mjs` charge loop).

**Permissions:** `apply_lots_from_raw` is `SECURITY DEFINER`; granted to `service_role`. SQL Editor as `postgres` can run it.

---

## Phase B — Transport → `raw_lots_charges_paid` → `apply_transport_charges_from_raw`

Use this when your source has **transport paid / receivable** per IN or OUT row (separate file, or columns exported into a dedicated CSV). Rows must **match** the same natural keys as lots import: `transaction_date`, `customer_code`, `customer_name`, `product_name`, `transfer_mode`, `lot_number`, and for **OUT** either `external_reference_id` or (`num_bags` + date) to resolve the delivery exactly as `apply_lots_from_raw` does.

### B.1 — Preflight: `product_charges` for TRANSPORT

Each **product** that appears in the overlay must have a `product_charges` row linked to charge type code **`TRANSPORT`**. If any product is missing it, the apply function raises.

```sql
SELECT p.product_name
FROM public.products p
WHERE p.tenant_id = '<tenant_id>'::uuid
  AND p.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_charges pc
    JOIN public.charge_types ct ON ct.id = pc.charge_type_id AND ct.tenant_id = p.tenant_id
    WHERE pc.product_id = p.id AND ct.code = 'TRANSPORT'
  );
```

Empty result = OK.

### B.2 — Truncate transport staging

```sql
TRUNCATE import_staging.raw_lots_charges_paid;
```

### B.3 — `\copy` into `raw_lots_charges_paid`

**Expected header** (all text columns; order must match the `\copy` list):

`transaction_date,customer_code,customer_name,product_name,transfer_mode,lot_number,num_bags,external_reference_id,transport_charges_paid,transport_charges_receivable`

- **IN:** `num_bags` should match the lot row; `external_reference_id` may be empty.
- **OUT:** supply **`external_reference_id`** when deliveries were keyed that way in Phase A; otherwise **`num_bags`** (bags out) + `transaction_date` must uniquely identify the delivery for that lot (same rules as `apply_lots_from_raw`).

Use **`psql`** with your DB URI (Supabase **Connect** → URI, or local after `supabase start`).

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\
\\copy import_staging.raw_lots_charges_paid (\
transaction_date, customer_code, customer_name, product_name, transfer_mode, lot_number,\
num_bags, external_reference_id, transport_charges_paid, transport_charges_receivable\
) FROM '/absolute/path/to/transport-overlay.csv' CSV HEADER\
"
```

If your export is a **wide** CSV (same row as `lots-and-deliveries` plus transport columns), build a derived file with only the columns above, or use a temp table + `INSERT INTO import_staging.raw_lots_charges_paid SELECT ...` in SQL.

### B.4 — Optional: disable triggers on `transaction_charges`

```sql
ALTER TABLE public.transaction_charges DISABLE TRIGGER USER;
-- run B.5, then:
ALTER TABLE public.transaction_charges ENABLE TRIGGER USER;
```

### B.5 — Run `apply_transport_charges_from_raw`

```sql
BEGIN;

SELECT import_staging.apply_transport_charges_from_raw(
  '<tenant_id>'::uuid,
  '<warehouse_id>'::uuid,
  false   -- true to TRUNCATE raw_lots_charges_paid after success
);

COMMIT;
-- or ROLLBACK;
```

**Return value (jsonb)** keys:

- `transport_in_inserted`, `transport_in_skipped_duplicate`
- `transport_out_inserted`, `transport_out_skipped_duplicate`

**Idempotency:** skips when a **TRANSPORT** `transaction_charges` row already exists for the same **IN** (`lot_id`, `delivery_id` null, `charge_date`) or **OUT** (`delivery_id`, `charge_date`) and the same `product_charge_type_id`.

**Errors:** `OUT transport: delivery not found` means Phase A did not create that delivery (wrong `external_reference_id` / `num_bags` / date, or lots CSV not applied yet).

**Permissions:** same pattern as `apply_lots_from_raw` — `service_role` + typically `postgres` in SQL Editor.

### B.6 — Cleanup transport staging

```sql
TRUNCATE import_staging.raw_lots_charges_paid;
```

(or pass `true` as the third argument to B.5.)

---

## Phase C — `operational-payments.csv` → `op_import` → `public.operational_payments`

Loads [`data/operational-payments.csv`](../../data/operational-payments.csv) into **`import_staging.op_import`**, then **`INSERT`s into `public.operational_payments`** with `lot_id` and `delivery_id` left **NULL** (warehouse staff/vendor lines). Linking operational rows to specific `transaction_charges` is **out of scope** unless your schema adds FKs and you extend the `INSERT`.

### C.1 — Create staging table (once per database)

If not created by a migration:

```sql
CREATE TABLE IF NOT EXISTS import_staging.op_import (
  amount_paid text,
  notes text,
  payment_type text,
  employee_id text,
  employee_name text,
  transaction_date text,
  legacy_transaction_id text
);

GRANT ALL ON TABLE import_staging.op_import TO service_role;
```

### C.2 — Truncate staging (each run)

```sql
TRUNCATE import_staging.op_import;
```

### C.3 — Load CSV into staging

**CSV header in this repo:** `amount_paid,notes,payment_type,EmployeeID,EmployeeName,transaction_date,legacy_transaction_id`

The `\copy` column list is **positional** (`EmployeeID` → `employee_id`, etc.):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "\
\\copy import_staging.op_import (\
amount_paid, notes, payment_type, employee_id, employee_name, transaction_date, legacy_transaction_id\
) FROM '/absolute/path/to/grow-cold/data/operational-payments.csv' CSV HEADER\
"
```

Use an **absolute** path to the CSV.

### C.4 — Preflight: missing payment types

```sql
SELECT DISTINCT btrim(i.payment_type) AS csv_type
FROM import_staging.op_import i
CROSS JOIN public.warehouses w
WHERE w.id = '<warehouse_id>'::uuid
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_types pt
    WHERE pt.tenant_id = w.tenant_id
      AND pt.name = btrim(i.payment_type)
  );
```

Empty result = OK.

### C.5 — Optional: disable triggers on `operational_payments`

```sql
ALTER TABLE public.operational_payments DISABLE TRIGGER USER;
```

Re-enable after C.6:

```sql
ALTER TABLE public.operational_payments ENABLE TRIGGER USER;
```

Requires a role that can disable triggers (often **`postgres`** in the SQL editor).

### C.6 — Insert into `public.operational_payments`

Replace **`<warehouse_id>`**. Adjust types/columns if your branch differs (e.g. no `op_payment_status`).

**Rules:**

- **`lot_id` / `delivery_id`:** `NULL` for this CSV path.
- **`payment_type_id`:** join `payment_types` on `tenant_id` + `name = btrim(payment_type)`.
- **`amount`:** `replace(btrim(amount_paid), ',', '')::numeric`.
- **`payment_date`:** `import_staging.parse_us_date(transaction_date)` (M/D/YYYY).
- **`status`:** `'PAID'::public.op_payment_status` (adjust if your enum differs).
- **`notes`:** from CSV `notes` only.
- **`expenditure_head`:** optional copy of `payment_type`.
- **`external_reference_id`:** `nullif(btrim(legacy_transaction_id), '')` if the column exists; otherwise omit from `INSERT`.
- **Party:** if **both** `employee_id` and `employee_name` are `NIL` (case-insensitive after trim), set **`party_name`** and **`party_phone`** to `NULL`. Otherwise build `id || ' - ' || name`, extract a **10-digit Indian mobile** into `party_phone` if present, strip from **`party_name`**.

```sql
INSERT INTO public.operational_payments (
  warehouse_id,
  tenant_id,
  payment_type_id,
  status,
  payment_date,
  amount,
  lot_id,
  delivery_id,
  party_name,
  party_phone,
  notes,
  expenditure_head,
  external_reference_id
)
SELECT
  w.id,
  w.tenant_id,
  pt.id,
  'PAID'::public.op_payment_status,
  import_staging.parse_us_date(i.transaction_date),
  replace(btrim(i.amount_paid), ',', '')::numeric,
  NULL::uuid,
  NULL::uuid,
  CASE
    WHEN upper(btrim(coalesce(i.employee_id, ''))) = 'NIL'
     AND upper(btrim(coalesce(i.employee_name, ''))) = 'NIL'
      THEN NULL::text
    ELSE btrim(
      regexp_replace(
        btrim(i.employee_id) || ' - ' || btrim(i.employee_name),
        '(?:\+91[\s-]?)?[6-9]\d{9}',
        '',
        'g'
      )
    )
  END,
  CASE
    WHEN upper(btrim(coalesce(i.employee_id, ''))) = 'NIL'
     AND upper(btrim(coalesce(i.employee_name, ''))) = 'NIL'
      THEN NULL::text
    ELSE (
      regexp_match(
        btrim(i.employee_id) || ' - ' || btrim(i.employee_name),
        '(?:\+91[\s-]?)?([6-9]\d{9})'
      )
    )[1]
  END,
  nullif(btrim(i.notes), ''),
  btrim(i.payment_type),
  nullif(btrim(i.legacy_transaction_id), '')
FROM import_staging.op_import i
CROSS JOIN public.warehouses w
JOIN public.payment_types pt
  ON pt.tenant_id = w.tenant_id
 AND pt.name = btrim(i.payment_type)
WHERE w.id = '<warehouse_id>'::uuid;
```

Wrap in `BEGIN;` … `ROLLBACK;` the first time to validate row counts.

### C.7 — Cleanup staging

```sql
TRUNCATE import_staging.op_import;
```

---

## Permissions and safety

- **`import_staging.parse_us_date`** and RPCs: `USAGE` on schema + `EXECUTE` on functions; staging tables are typically granted to **`service_role`** by migrations.
- **`INSERT` into `public.*`** must satisfy **RLS** unless you run as **`postgres`** / **service role**.
- **Duplicates:** Phase B skips duplicate TRANSPORT lines; Phase C does not dedupe `legacy_transaction_id` unless you add `WHERE NOT EXISTS (...)`.
- **No automatic rollback** of `public.*`; use `BEGIN` / `ROLLBACK` while testing.

---

## Files involved

| Area | File |
|------|------|
| Lots staging + apply | `supabase/migrations/20260426120000_import_staging_lots_raw.sql`, `20260426120100_import_staging_apply_lots_from_raw.sql` |
| Transport staging + apply | `supabase/migrations/20260430120000_import_staging_transport_charges_overlay.sql` |
| Lots CSV + detailed steps | [`IMPORT_LOTS_STAGING.md`](IMPORT_LOTS_STAGING.md), `data/lots-and-deliveries.csv` |
| Operational CSV | `data/operational-payments.csv` |

If you later merge transport columns into **`raw_lots_and_deliveries`** and extend **`apply_lots_from_raw`** to insert TRANSPORT in one pass, you can drop Phase B from your runbook and keep only Phase A + C.
