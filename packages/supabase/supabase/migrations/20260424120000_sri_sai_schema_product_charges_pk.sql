-- Products: chargeable_bag_size + generated rent; charge_types: TRANSPORT, INSURANCE, PLATFORM->PLATFORM_HAMALI;
-- lots/deliveries: legacy fields + external ref; customers: phone nullable, composite unique;
-- product_charges: surrogate PK; transaction_charges: FK to product_charges, charge_date, legacy paid, num_bags, nullable delivery_id.

-- ---------------------------------------------------------------------------
-- 1. Products: drop generated, drop bag_size, add chargeable_bag_size + generated
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  DROP COLUMN IF EXISTS monthly_rent_per_bag,
  DROP COLUMN IF EXISTS yearly_rent_per_bag;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_bag_size_check,
  DROP COLUMN IF EXISTS bag_size;

ALTER TABLE public.products
  ADD COLUMN chargeable_bag_size numeric(12, 4);

ALTER TABLE public.products
  ADD COLUMN bag_size numeric(12, 4);

ALTER TABLE public.products
  ADD CONSTRAINT products_chargeable_bag_size_check
    CHECK (chargeable_bag_size IS NULL OR chargeable_bag_size > 0);

ALTER TABLE public.products
  ADD COLUMN monthly_rent_per_bag numeric(16, 4) GENERATED ALWAYS AS (
    CASE
      WHEN chargeable_bag_size IS NOT NULL AND monthly_rent_per_kg IS NOT NULL
      THEN monthly_rent_per_kg * chargeable_bag_size
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.products
  ADD COLUMN yearly_rent_per_bag numeric(16, 4) GENERATED ALWAYS AS (
    CASE
      WHEN chargeable_bag_size IS NOT NULL AND yearly_rent_per_kg IS NOT NULL
      THEN yearly_rent_per_kg * chargeable_bag_size
      ELSE NULL
    END
  ) STORED;

-- ---------------------------------------------------------------------------
-- 2. Charge types: new codes + rename PLATFORM
-- ---------------------------------------------------------------------------
INSERT INTO public.charge_types (tenant_id, code, display_name, sort_order)
SELECT
  t.id,
  v.code,
  v.display_name,
  v.sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('TRANSPORT', 'Transport', 5),
    ('INSURANCE', 'Insurance', 6)
) AS v(code, display_name, sort_order)
ON CONFLICT ON CONSTRAINT charge_types_tenant_code_key DO NOTHING;

UPDATE public.charge_types
SET
  code = 'PLATFORM_HAMALI',
  display_name = 'Platform Hamali',
  updated_at = now()
WHERE code = 'PLATFORM';

-- ---------------------------------------------------------------------------
-- 3. Lots / deliveries: columns + drop lot_number format check
-- ---------------------------------------------------------------------------
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS legacy_locations text,
  ADD COLUMN IF NOT EXISTS external_reference_id text;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS legacy_locations text,
  ADD COLUMN IF NOT EXISTS location_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS external_reference_id text;

ALTER TABLE public.lots
  DROP CONSTRAINT IF EXISTS lots_lot_number_format_check;

-- ---------------------------------------------------------------------------
-- 4. Customers: nullable phone, composite unique (replace warehouse+code)
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_warehouse_customer_code_key;

ALTER TABLE public.customers
  ADD CONSTRAINT customers_warehouse_code_name_key
  UNIQUE (warehouse_id, customer_code, customer_name);

-- ---------------------------------------------------------------------------
-- 5. product_charges: surrogate primary key
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_charges
  ADD COLUMN product_charge_type_id uuid;

UPDATE public.product_charges
SET product_charge_type_id = gen_random_uuid()
WHERE product_charge_type_id IS NULL;

ALTER TABLE public.product_charges
  ALTER COLUMN product_charge_type_id SET NOT NULL,
  ADD CONSTRAINT product_charges_pkey PRIMARY KEY (product_charge_type_id);

ALTER TABLE public.product_charges
  ALTER COLUMN product_charge_type_id SET DEFAULT gen_random_uuid();

-- ---------------------------------------------------------------------------
-- 6. transaction_charges: product_charge_type_id, drop charge_type_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.transaction_charges
  ADD COLUMN product_charge_type_id uuid;

UPDATE public.transaction_charges tc
SET product_charge_type_id = pc.product_charge_type_id
FROM public.lots l
JOIN public.product_charges pc
  ON pc.product_id = l.product_id
WHERE tc.lot_id = l.id
  AND pc.charge_type_id = tc.charge_type_id;

ALTER TABLE public.transaction_charges
  DROP CONSTRAINT transaction_charges_charge_type_id_fkey;

ALTER TABLE public.transaction_charges
  DROP COLUMN charge_type_id;

ALTER TABLE public.transaction_charges
  ADD CONSTRAINT transaction_charges_product_charge_type_id_fkey
  FOREIGN KEY (product_charge_type_id) REFERENCES public.product_charges (product_charge_type_id)
  ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.transaction_charges WHERE product_charge_type_id IS NULL) THEN
    RAISE EXCEPTION 'migration: transaction_charges rows exist without product_charge_type_id backfill';
  END IF;
END
$$;

ALTER TABLE public.transaction_charges
  ALTER COLUMN product_charge_type_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 7. transaction_charges: charge_date, legacy_amount_paid, num_bags; drop rate_per_unit; nullable delivery_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.transaction_charges
  ADD COLUMN charge_date date,
  ADD COLUMN legacy_amount_paid numeric(12, 2),
  ADD COLUMN num_bags integer;

UPDATE public.transaction_charges tc
SET charge_date = COALESCE(tc.paid_date, l.lodgement_date, (tc.created_at AT TIME ZONE 'UTC')::date)
FROM public.lots l
WHERE tc.lot_id = l.id
  AND tc.charge_date IS NULL;

UPDATE public.transaction_charges
SET charge_date = (created_at AT TIME ZONE 'UTC')::date
WHERE charge_date IS NULL;

ALTER TABLE public.transaction_charges
  ALTER COLUMN charge_date SET NOT NULL;

ALTER TABLE public.transaction_charges
  DROP COLUMN IF EXISTS rate_per_unit;

ALTER TABLE public.transaction_charges
  ALTER COLUMN delivery_id DROP NOT NULL;