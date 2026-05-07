# Postgres-only import: staging + `apply_lots_from_raw`

This path loads `lots-and-deliveries.csv` into `import_staging.raw_lots_and_deliveries`, then applies rows into `public.lots`, `public.deliveries`, and `public.transaction_charges` inside Postgres. **TRANSPORT** is not created here; use **Phase B** in [`IMPORT_OPERATIONAL_PAYMENTS_STAGING.md`](IMPORT_OPERATIONAL_PAYMENTS_STAGING.md) (`raw_lots_charges_paid` + `apply_transport_charges_from_raw`) after a successful apply.

It does **not** replace or modify `scripts/import-sri-sai-padala.mjs`. Compare results on a branch / copy of the database before relying on it in production.

## Prerequisites

1. **Migrations applied** (includes `import_staging` schema, staging table, and `import_staging.apply_lots_from_raw`).
2. **Same data the Node import expects** already in the DB for the target warehouse:
   - `customers` (warehouse + code + name match CSV)
   - `products` + `product_charges` + `charge_types` (HAMALI, KATA_COOLIE, MAMULLE, PLATFORM_HAMALI)
   - `locations` (names referenced in legacy location strings resolve to rows for that warehouse)

3. Resolve **tenant** and **warehouse** UUIDs, e.g.:

```sql
SELECT t.id AS tenant_id, w.id AS warehouse_id
FROM public.tenants t
JOIN public.warehouses w ON w.tenant_id = t.id
WHERE t.name = 'Sri Sai Cold Storage'
  AND w.warehouse_name ILIKE '%Padala%';
```

## Step 1 — Apply migrations

From repo root:

```bash
pnpm db:reset
```

Or push migrations only to a linked remote:

```bash
pnpm --filter @growcold/supabase exec supabase db push
```

## Step 2 — Truncate staging (optional)

```sql
TRUNCATE import_staging.raw_lots_and_deliveries;
```

## Step 3 — Load CSV into staging

Use **`psql`** with the project database connection string (Supabase dashboard → **Connect** → **URI**, or local `postgresql://postgres:postgres@127.0.0.1:54322/postgres` after `supabase start`).

From your machine (paths absolute):

> $DATABASE_URL=postgresql://postgres.lezpukcoyrovuhjghozu:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true

```bash
psql "postgresql://postgres.lezpukcoyrovuhjghozu:[YOUR-PASSWORD]@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" -v ON_ERROR_STOP=1 -c "\
\\copy import_staging.raw_lots_and_deliveries (\
transaction_date, customer_code, customer_name, product_name, product_group_name, transfer_mode, lot_number, num_bags,\
lots_legacy_locations, deliveries_legacy_locations, driver_name, vehicle_number, notes,\
hamali_charges_paid, hamali_charges_receivable, hamali_charges_per_bag,\
kata_coolie_charges_paid, kata_coolie_charges_receivable,\
mamullu_charges_paid, mamullu_charges_receivable,\
platform_hamali_charges_paid, platform_hamali_charges_receivable,\
external_reference_id\
) FROM '~/projects/grow-cold/data/lots-and-deliveries.csv' CSV HEADER\
"
```

Notes:

- The column list must match your CSV header order (same as `data/lots-and-deliveries.csv` in this repo).
- `id` is omitted so `bigserial` fills in.
- `hamali_charges_per_bag` is stored as text like other numeric columns; the apply function does not use it today (same as the Node script’s charge specs).

## Step 4 — Run the apply function

Use the UUIDs from Step 0.

**Dry run semantics:** the function always mutates when it succeeds. Test on a disposable DB first.

```sql
BEGIN;

SELECT import_staging.apply_lots_from_raw(
  '<tenant_id>'::uuid,
  '<warehouse_id>'::uuid,
  false   -- set true to TRUNCATE staging after a successful apply
);

-- Inspect counts / sample rows, then:
COMMIT;
-- or ROLLBACK;
```

Return value is a `jsonb` summary, e.g.:

- `in_lots_inserted`, `in_lots_reused`
- `in_charge_batches_inserted`, `in_charge_batches_skipped`
- `out_deliveries_inserted`, `out_deliveries_reused`
- `out_charge_batches_inserted`, `out_charge_batches_skipped`

{
    "in_lots_reused":1098,
    "in_lots_inserted":2494,
    "out_deliveries_reused":3245,
    "out_deliveries_inserted":19308,
    "in_charge_batches_skipped":0,
    "in_charge_batches_inserted":3592,
    "out_charge_batches_skipped":3244,
    "out_charge_batches_inserted":19309
}

## Permissions

`apply_lots_from_raw` is **`SECURITY DEFINER`** and is granted to **`service_role`** only. The Supabase **SQL Editor** typically runs as `postgres` and can execute it. A anon/authenticated client must use the **service role** key (server-side only) or run SQL via `psql` as a superuser.

## Re-runs and safety

- Behavior is aligned with the Node importer’s **natural-key** reuse (existing lot / delivery / charge batches skipped where the script would skip).
- Re-applying the **same** staging rows after a successful apply can still create extra rows if a skip condition does not match (same caveats as iterative importers). Prefer **`TRUNCATE` staging** after success (`third arg true`) and keep backups.
- There is **no** automatic rollback of `public.*` tables; use `BEGIN` / `ROLLBACK` around the `SELECT` while testing.

## Files added

| File | Purpose |
|------|---------|
| `supabase/migrations/20260426120000_import_staging_lots_raw.sql` | Schema `import_staging`, table `raw_lots_and_deliveries`, grants |
| `supabase/migrations/20260426120100_import_staging_apply_lots_from_raw.sql` | Helpers + `import_staging.apply_lots_from_raw` |
| `supabase/migrations/20260430120000_import_staging_transport_charges_overlay.sql` | `raw_lots_charges_paid` + `apply_transport_charges_from_raw` (TRANSPORT overlay) |

## Optional: invoke from app

```ts
const { data, error } = await adminClient.rpc('apply_lots_from_raw', {
  p_tenant_id: tenantId,
  p_warehouse_id: warehouseId,
  p_truncate_staging: true,
});
```

Expose a thin Postgres wrapper in `public` if you need a stable RPC name without schema prefix (not included by default).

**See also:** [`IMPORT_OPERATIONAL_PAYMENTS_STAGING.md`](IMPORT_OPERATIONAL_PAYMENTS_STAGING.md) for bulk loading `operational-payments.csv` into `public.operational_payments`.
