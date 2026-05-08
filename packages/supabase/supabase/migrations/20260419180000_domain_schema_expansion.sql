-- Customers: codes, second mobile, category; charge_types table; product_charges;
-- product pricing + generated per-bag rent; locations; lots/deliveries/rent_accruals updates.

-- ---------------------------------------------------------------------------
-- 1. Customer category
-- ---------------------------------------------------------------------------
CREATE TYPE public.customer_category AS ENUM ('TRADER', 'FARMER');

ALTER TABLE public.customers
  ADD COLUMN customer_code text,
  ADD COLUMN mobile text,
  ADD COLUMN category public.customer_category;

UPDATE public.customers
SET customer_code = 'C/' || substr(replace(id::text, '-', ''), 1, 12)
WHERE customer_code IS NULL;

UPDATE public.customers
SET category = 'TRADER'
WHERE category IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN customer_code SET NOT NULL,
  ALTER COLUMN category SET NOT NULL,
  ADD CONSTRAINT customers_customer_code_format_check
    CHECK (customer_code ~ '^[A-Za-z0-9./\-]+$'),
  ADD CONSTRAINT customers_warehouse_customer_code_key UNIQUE (warehouse_id, customer_code);

-- ---------------------------------------------------------------------------
-- 2. Charge types (replaces charge_type enum)
-- ---------------------------------------------------------------------------
CREATE TABLE public.charge_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id) ON DELETE CASCADE,
  code text NOT NULL,
  display_name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT charge_types_tenant_code_key UNIQUE (tenant_id, code)
);

CREATE INDEX idx_charge_types_tenant_id ON public.charge_types (tenant_id);

CREATE TRIGGER set_charge_types_updated_at
  BEFORE UPDATE ON public.charge_types
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

INSERT INTO public.charge_types (tenant_id, code, display_name, sort_order)
SELECT
  t.id,
  v.code,
  v.display_name,
  v.sort_order
FROM public.tenants t
CROSS JOIN (
  VALUES
    ('HAMALI', 'Hamali', 1),
    ('PLATFORM', 'Platform', 2),
    ('KATA_COOLIE', 'Kata Coolie', 3),
    ('MAMULLE', 'Mamulle', 4)
) AS v(code, display_name, sort_order);

ALTER TABLE public.transaction_charges
  ADD COLUMN charge_type_id uuid REFERENCES public.charge_types (id);

UPDATE public.transaction_charges tc
SET charge_type_id = ct.id
FROM public.lots l
JOIN public.charge_types ct
  ON ct.tenant_id = l.tenant_id
WHERE tc.lot_id = l.id
 AND ct.code = tc.charge_type::text;

ALTER TABLE public.transaction_charges
  ALTER COLUMN charge_type_id SET NOT NULL;

ALTER TABLE public.transaction_charges
  DROP COLUMN charge_type;

DROP TYPE public.charge_type;

-- ---------------------------------------------------------------------------
-- 3. Product charges (per bag, per charge type)
-- ---------------------------------------------------------------------------
CREATE TABLE public.product_charges (
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  charge_type_id uuid NOT NULL REFERENCES public.charge_types (id) ON DELETE RESTRICT,
  charges_per_bag numeric(12, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_charges_charges_nonneg_check CHECK (charges_per_bag >= 0),
  CONSTRAINT product_charges_product_charge_type_key UNIQUE (product_id, charge_type_id)
);

CREATE INDEX idx_product_charges_charge_type_id ON public.product_charges (charge_type_id);

CREATE TRIGGER set_product_charges_updated_at
  BEFORE UPDATE ON public.product_charges
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Products: bag size, rent per kg; generated per-bag = per_kg * bag_size
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN bag_size numeric(12, 4),
  ADD COLUMN monthly_rent_per_kg numeric(14, 4),
  ADD COLUMN yearly_rent_per_kg numeric(14, 4);

ALTER TABLE public.products
  ADD CONSTRAINT products_bag_size_check CHECK (bag_size IS NULL OR bag_size > 0);

ALTER TABLE public.products
  ADD COLUMN monthly_rent_per_bag numeric(16, 4) GENERATED ALWAYS AS (
    CASE
      WHEN bag_size IS NOT NULL AND monthly_rent_per_kg IS NOT NULL
      THEN monthly_rent_per_kg * bag_size
      ELSE NULL
    END
  ) STORED;

ALTER TABLE public.products
  ADD COLUMN yearly_rent_per_bag numeric(16, 4) GENERATED ALWAYS AS (
    CASE
      WHEN bag_size IS NOT NULL AND yearly_rent_per_kg IS NOT NULL
      THEN yearly_rent_per_kg * bag_size
      ELSE NULL
    END
  ) STORED;

-- ---------------------------------------------------------------------------
-- 5. Locations (per warehouse; name unique within warehouse)
-- ---------------------------------------------------------------------------
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_warehouse_name_key UNIQUE (warehouse_id, name),
  CONSTRAINT locations_name_format_check CHECK (name ~ '^[A-Za-z0-9/]+$')
);

CREATE INDEX idx_locations_tenant_id ON public.locations (tenant_id);
CREATE INDEX idx_locations_warehouse_id ON public.locations (warehouse_id);

-- ---------------------------------------------------------------------------
-- 6. Lots: location_ids, transport; drop rental_amount & charges_frozen
-- ---------------------------------------------------------------------------
ALTER TABLE public.lots
  ADD COLUMN location_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN driver_name text,
  ADD COLUMN vehicle_number text;

ALTER TABLE public.lots
  DROP COLUMN rental_amount,
  DROP COLUMN charges_frozen;

-- ---------------------------------------------------------------------------
-- 7. Deliveries: delivery_status enum, notes rename, transport
-- ---------------------------------------------------------------------------
CREATE TYPE public.delivery_status AS ENUM ('SCHEDULED', 'DELIVERED', 'BLOCKED');

ALTER TABLE public.deliveries ADD COLUMN status_new public.delivery_status;

UPDATE public.deliveries
SET status_new = CASE lower(trim(status))
  WHEN 'blocked' THEN 'BLOCKED'::public.delivery_status
  WHEN 'scheduled' THEN 'SCHEDULED'::public.delivery_status
  ELSE 'DELIVERED'::public.delivery_status
END;

ALTER TABLE public.deliveries DROP COLUMN status;
ALTER TABLE public.deliveries RENAME COLUMN status_new TO status;

ALTER TABLE public.deliveries
  ALTER COLUMN status SET DEFAULT 'DELIVERED'::public.delivery_status,
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.deliveries RENAME COLUMN delivery_notes TO notes;

ALTER TABLE public.deliveries
  ADD COLUMN driver_name text,
  ADD COLUMN vehicle_number text;

-- ---------------------------------------------------------------------------
-- 8. Rent accruals: accrual period
-- ---------------------------------------------------------------------------
ALTER TABLE public.rent_accruals
  ADD COLUMN accrual_from date,
  ADD COLUMN accrual_to date;

UPDATE public.rent_accruals
SET accrual_from = accrual_date,
    accrual_to = accrual_date
WHERE accrual_from IS NULL;

ALTER TABLE public.rent_accruals
  ALTER COLUMN accrual_from SET NOT NULL,
  ALTER COLUMN accrual_to SET NOT NULL;

ALTER TABLE public.rent_accruals
  ADD CONSTRAINT rent_accruals_period_check CHECK (accrual_to >= accrual_from);

-- ---------------------------------------------------------------------------
-- RLS: charge_types, product_charges, locations
-- ---------------------------------------------------------------------------
ALTER TABLE public.charge_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY charge_types_select ON public.charge_types
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY charge_types_insert ON public.charge_types
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY charge_types_update ON public.charge_types
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY locations_select ON public.locations
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY locations_insert ON public.locations
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = warehouse_id
        AND w.tenant_id = tenant_id
    )
  );

CREATE POLICY locations_update ON public.locations
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.warehouses w
      WHERE w.id = warehouse_id
        AND w.tenant_id = tenant_id
    )
  );

CREATE POLICY product_charges_select ON public.product_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_charges.product_id
        AND p.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY product_charges_insert ON public.product_charges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_charges.product_id
        AND p.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.charge_types ct
      WHERE ct.id = product_charges.charge_type_id
        AND ct.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY product_charges_update ON public.product_charges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_charges.product_id
        AND p.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_charges.product_id
        AND p.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.charge_types ct
      WHERE ct.id = product_charges.charge_type_id
        AND ct.tenant_id = public.current_tenant_id()
    )
  );

GRANT ALL ON public.charge_types TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charge_types TO authenticated;

GRANT ALL ON public.product_charges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_charges TO authenticated;

GRANT ALL ON public.locations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
