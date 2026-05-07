# Rent accruals: one-time backfill + monthly job

This document covers **Postgres-only** historical rent accruals (`backfill_rent_accruals`) and the **monthly** run that uses the same engine with a **narrower lot set** (default) for live warehouses. Business rules are in **§1.5** of [`specs/COLD_STORAGE_MVP_CTO_SPEC.md`](../../specs/COLD_STORAGE_MVP_CTO_SPEC.md).

Migrations that matter:

| Migration | Purpose |
|-----------|---------|
| `20260501120000_rent_accrual_engine.sql` | `yearly_rent_cutoff_month` / `day`, `generate_rent_accruals_for_month`, `backfill_rent_accruals`, narrow-vs-full lot scope |
| `20260502120000_import_staging_rental_mode_warehouse.sql` | `import_staging.rental_mode_from_date` + warehouse cutoff (independent of accrual backfill) |

## Prerequisites

1. **Migrations applied** (including `rent_accruals` + unique `(lot_id, accrual_from, accrual_to)` for idempotency).
2. **Lots, deliveries, products, `warehouse_settings`** (`grace_period_months`, yearly cutoff month/day) are already loaded for the period you are accruing. Backfill **reconstructs** balances from `deliveries` + `original_bags`; it does not import CSV by itself.
3. **Product rates** (`monthly_rent_per_bag`, `yearly_rent_per_bag`) set where accruals are required; lots with missing rates are skipped in the function summary (`skipped_no_rate`).

## One-time backfill (SQL / psql)

`public.backfill_rent_accruals` loops **each calendar month** in the database and, for every month, calls `generate_rent_accruals_for_month` with **`p_narrow_lot_scope = false`** so **all** non-excluded lots (see migration) are considered—required for history where most rows are **DELIVERED** / **CLEARED**.

**Parameters**

| Parameter | Default | Meaning |
|-----------|---------|--------|
| `p_warehouse_id` | `NULL` | `NULL` = all warehouses; else a single `warehouses.id`. |
| `p_from_month` | `'2023-01-01'` | Any date in the **first** month to process (normalized to month start). |
| `p_through_month` | End of **previous** calendar month (when omitted) | Last month included (month-normalized). |

Returns JSON with `from`, `through`, and `per_month` (each entry has `accrual_month` + nested `result` from `generate_rent_accruals_for_month`).

### Example — all warehouses, fixed window

Run from **Supabase SQL Editor** (as `postgres`) or **`psql`** with your DB URI:

```sql
SELECT public.backfill_rent_accruals(
  NULL::uuid,
  '2023-01-01'::date,
  '2025-12-01'::date
);
```

### Example — one warehouse

```sql
SELECT public.backfill_rent_accruals(
  '<warehouse_id>'::uuid,
  '2023-01-01'::date,
  '2025-12-01'::date
);
```

### After deploy on a project that never ran backfill

Use a `through` month that matches your go-live window (often **end of previous month** before turning on the monthly cron). Re-running the same range is **idempotent** (`ON CONFLICT DO NOTHING` on accrual periods).

### Permissions

Functions are **`SECURITY DEFINER`** and granted to **`service_role`** only. The dashboard SQL editor typically runs as **`postgres`**. Do **not** expose these RPCs to `anon` / `authenticated` clients without a separate orchestrator policy.

---

## Monthly cron (`monthly-rent-accrual` Edge Function)

The Edge Function **`supabase/functions/monthly-rent-accrual`** invokes:

```text
generate_rent_accruals_for_month(
  p_warehouse_id := NULL,
  p_month := <15th of previous calendar month in UTC>
)
```

Omitting **`p_narrow_lot_scope`** uses the default **`true`**, which restricts processing to **ACTIVE/STALE** lots plus **DELIVERED/CLEARED** rows with **`updated_at` ≥ accrual month start − 1 month** (see migration). That keeps monthly runs fast; backfill is the place for the full historical set.

**Auth:** the function expects header **`Authorization: Bearer <RENT_ACCRUAL_CRON_SECRET>`**. Set the secret in the function’s environment (Supabase **Project Settings → Edge Functions → Secrets**), e.g. `RENT_ACCRUAL_CRON_SECRET`, plus `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (usually provided by the platform).

**Local `config.toml`:** `[functions.monthly-rent-accrual] verify_jwt = false` so the cron can call with a static bearer token instead of a user JWT.

### Step 1 — Deploy the function

From `packages/supabase` (or repo root with correct filter):

```bash
pnpm exec supabase functions deploy monthly-rent-accrual --project-ref <your-project-ref>
```

### Step 2 — Configure secrets

In the Supabase dashboard (or CLI), set at minimum:

- `RENT_ACCRUAL_CRON_SECRET` — long random string; only schedulers know it  
- `SUPABASE_SERVICE_ROLE_KEY` — if not already injected for Edge Functions in your project  

### Step 3 — Schedule the cron

**Supabase (recommended):** **Integrations → Cron** (or **Database → Extensions → pg_net** + Supabase cron docs, depending on your plan)—schedule an HTTP **POST** (or GET if you adapt the function) to:

```text
https://<project-ref>.supabase.co/functions/v1/monthly-rent-accrual
```

with header:

```http
Authorization: Bearer <same value as RENT_ACCRUAL_CRON_SECRET>
```

Pick a schedule after monthend in your timezone (e.g. **02:00 UTC on day 1** accrues the **previous** calendar month per the function’s date logic).

**Alternative:** enable **`pg_cron`** in the database and run SQL that calls `generate_rent_accruals_for_month(...)` with an explicit `p_month`—no Edge layer; still use **`service_role`** / privileged execution only.

### Manual smoke test

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $RENT_ACCRUAL_CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://<project-ref>.supabase.co/functions/v1/monthly-rent-accrual"
```

Expect JSON like `{ "p_month": "2026-03-15", "result": { ... } }` when run in April 2026 (previous month = March).

---

## Optional: invoke RPC from a trusted server

```ts
const { data, error } = await adminClient.rpc('generate_rent_accruals_for_month', {
  p_warehouse_id: null,
  p_month: '2026-03-15',
  p_narrow_lot_scope: true,
});
```

Use **`p_narrow_lot_scope: false`** only for repairs that must match backfill semantics.

**See also:** [`IMPORT_LOTS_STAGING.md`](IMPORT_LOTS_STAGING.md) for CSV → `lots` / `deliveries` (run **before** backfilling accruals for imported history).
