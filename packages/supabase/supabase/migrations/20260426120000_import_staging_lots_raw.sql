-- Staging + bulk apply for lots-and-deliveries CSV (Postgres-only path).
-- Does not modify scripts/import-sri-sai-padala.mjs.
-- After COPY into import_staging.raw_lots_and_deliveries, call:
--   SELECT import_staging.apply_lots_from_raw('<tenant_id>'::uuid, '<warehouse_id>'::uuid, true);

CREATE SCHEMA IF NOT EXISTS import_staging;

REVOKE ALL ON SCHEMA import_staging FROM PUBLIC;

GRANT USAGE ON SCHEMA import_staging TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA import_staging TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA import_staging TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA import_staging GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA import_staging GRANT ALL ON SEQUENCES TO service_role;

-- Raw CSV columns (all text for easy \copy from CSV HEADER)
CREATE TABLE IF NOT EXISTS import_staging.raw_lots_and_deliveries (
  id bigserial PRIMARY KEY,
  transaction_date text NOT NULL,
  customer_code text NOT NULL,
  customer_name text NOT NULL,
  product_name text NOT NULL,
  product_group_name text,
  transfer_mode text NOT NULL,
  lot_number text NOT NULL,
  num_bags text,
  lots_legacy_locations text,
  deliveries_legacy_locations text,
  driver_name text,
  vehicle_number text,
  notes text,
  hamali_charges_paid text,
  hamali_charges_receivable text,
  hamali_charges_per_bag text,
  kata_coolie_charges_paid text,
  kata_coolie_charges_receivable text,
  mamullu_charges_paid text,
  mamullu_charges_receivable text,
  platform_hamali_charges_paid text,
  platform_hamali_charges_receivable text,
  external_reference_id text
);

CREATE INDEX IF NOT EXISTS idx_raw_lots_deliv_txdate_id
  ON import_staging.raw_lots_and_deliveries (id);

COMMENT ON TABLE import_staging.raw_lots_and_deliveries IS
  'Load lots-and-deliveries.csv via \\copy or Dashboard import, then SELECT import_staging.apply_lots_from_raw(...).';
