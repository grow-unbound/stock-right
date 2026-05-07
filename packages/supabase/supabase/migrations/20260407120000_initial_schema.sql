-- StockRight initial schema: multitenancy, user_profiles + user_roles, domain tables, RLS (minimal triggers).

-- ---------------------------------------------------------------------------
-- ENUMs
-- ---------------------------------------------------------------------------
CREATE TYPE public.lot_status AS ENUM (
  'ACTIVE',
  'STALE',
  'DELIVERED',
  'CLEARED',
  'WRITTEN_OFF',
  'DISPUTED'
);

CREATE TYPE public.user_role AS ENUM (
  'OWNER',
  'MANAGER',
  'STAFF'
);

CREATE TYPE public.rental_mode AS ENUM (
  'YEARLY',
  'MONTHLY',
  'BROUGHT_FORWARD'
);

CREATE TYPE public.charge_type AS ENUM (
  'HAMALI',
  'PLATFORM',
  'KATA_COOLIE',
  'MAMULLE'
);

CREATE TYPE public.payment_method AS ENUM (
  'CASH',
  'BANK_TRANSFER',
  'CHEQUE',
  'UPI',
  'OTHER'
);

-- ---------------------------------------------------------------------------
-- Core identity & tenant
-- ---------------------------------------------------------------------------
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  warehouse_name text NOT NULL,
  warehouse_code text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pincode text,
  manager_name text,
  manager_phone text,
  address text,
  capacity_bags integer NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouses_warehouse_code_key UNIQUE (warehouse_code)
);

CREATE INDEX idx_warehouses_tenant_id ON public.warehouses (tenant_id);
CREATE INDEX idx_warehouses_city ON public.warehouses (city);

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  phone text NOT NULL,
  display_name text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_phone ON public.user_profiles (phone);

CREATE TABLE public.user_roles (
  user_id uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX idx_user_roles_tenant_id ON public.user_roles (tenant_id);

CREATE TABLE public.user_warehouse_assignments (
  user_id uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, warehouse_id)
);

-- ---------------------------------------------------------------------------
-- RLS helpers (public schema)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.tenant_id
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.accessible_warehouse_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uwa.warehouse_id
  FROM public.user_warehouse_assignments uwa
  WHERE uwa.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Operational tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  customer_name text NOT NULL,
  phone text NOT NULL,
  address text,
  gstin text,
  credit_limit numeric(12, 2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_unique_phone_per_warehouse UNIQUE (warehouse_id, phone)
);

CREATE INDEX idx_customers_warehouse_id ON public.customers (warehouse_id);
CREATE INDEX idx_customers_tenant_warehouse ON public.customers (tenant_id, warehouse_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  product_name text NOT NULL,
  product_group_id uuid,
  stale_days_limit integer,
  storage_temperature text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_stale_days_limit_check CHECK (
    stale_days_limit IS NULL OR stale_days_limit > 0
  )
);

CREATE INDEX idx_products_tenant_id ON public.products (tenant_id);
CREATE INDEX idx_products_is_active ON public.products (is_active);

CREATE TABLE public.lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE RESTRICT,
  original_bags integer NOT NULL,
  balance_bags integer NOT NULL,
  lodgement_date date NOT NULL,
  rental_mode public.rental_mode NOT NULL,
  rental_amount numeric(12, 2) NOT NULL,
  status public.lot_status NOT NULL DEFAULT 'ACTIVE',
  charges_frozen boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lots_balance_bags_check CHECK (
    balance_bags >= 0
    AND balance_bags <= original_bags
  )
);

CREATE INDEX idx_lots_warehouse_status ON public.lots (warehouse_id, status);
CREATE INDEX idx_lots_customer_id ON public.lots (customer_id);
CREATE INDEX idx_lots_product_id ON public.lots (product_id);
CREATE INDEX idx_lots_tenant_warehouse ON public.lots (tenant_id, warehouse_id);

CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots (id) ON DELETE RESTRICT,
  num_bags_out integer NOT NULL,
  delivery_date date NOT NULL,
  status text NOT NULL DEFAULT 'COMPLETED',
  blocked_reason text,
  overridden_by uuid REFERENCES public.user_profiles (id),
  override_reason text,
  override_at timestamptz,
  delivery_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_num_bags_out_check CHECK (num_bags_out > 0)
);

CREATE INDEX idx_deliveries_lot_id ON public.deliveries (lot_id);

CREATE TABLE public.transaction_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries (id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.lots (id) ON DELETE CASCADE,
  charge_type public.charge_type NOT NULL,
  charge_amount numeric(12, 2) NOT NULL,
  rate_per_unit numeric(12, 4),
  is_paid boolean NOT NULL DEFAULT false,
  paid_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_charges_paid_date_check CHECK (
    (is_paid = false AND paid_date IS NULL)
    OR (is_paid = true AND paid_date IS NOT NULL)
  )
);

CREATE INDEX idx_transaction_charges_delivery_id ON public.transaction_charges (delivery_id);
CREATE INDEX idx_transaction_charges_lot_id ON public.transaction_charges (lot_id);

CREATE TABLE public.rent_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots (id) ON DELETE CASCADE,
  accrual_date date NOT NULL,
  rental_amount numeric(12, 2) NOT NULL,
  rental_mode public.rental_mode NOT NULL,
  is_paid boolean NOT NULL DEFAULT false,
  paid_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rent_accruals_paid_date_check CHECK (
    (is_paid = false AND paid_date IS NULL)
    OR (is_paid = true AND paid_date IS NOT NULL)
  )
);

CREATE INDEX idx_rent_accruals_lot_id ON public.rent_accruals (lot_id);

CREATE TABLE public.customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  receipt_date date NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  payment_method public.payment_method,
  reference_number text,
  notes text,
  recorded_by uuid REFERENCES public.user_profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_receipts_customer_id ON public.customer_receipts (customer_id);
CREATE INDEX idx_customer_receipts_warehouse_id ON public.customer_receipts (warehouse_id);

CREATE TABLE public.receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.customer_receipts (id) ON DELETE CASCADE,
  rent_accrual_id uuid REFERENCES public.rent_accruals (id) ON DELETE CASCADE,
  charge_id uuid REFERENCES public.transaction_charges (id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL,
  allocated_by uuid REFERENCES public.user_profiles (id),
  allocated_manually boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT receipt_allocations_xor_check CHECK (
    (rent_accrual_id IS NOT NULL AND charge_id IS NULL)
    OR (rent_accrual_id IS NULL AND charge_id IS NOT NULL)
  )
);

CREATE INDEX idx_receipt_allocations_receipt_id ON public.receipt_allocations (receipt_id);

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  user_id uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  reason text,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_warehouse_created ON public.audit_log (warehouse_id, created_at DESC);

CREATE TABLE public.lot_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots (id) ON DELETE CASCADE,
  old_status public.lot_status,
  new_status public.lot_status NOT NULL,
  reason text,
  changed_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lot_status_history_lot_id ON public.lot_status_history (lot_id);

CREATE TABLE public.warehouse_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL UNIQUE REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  blanket_stale_days integer NOT NULL DEFAULT 180,
  follow_up_outstanding_days integer NOT NULL DEFAULT 30,
  yearly_rent_cutoff_date date NOT NULL DEFAULT '2026-01-01',
  grace_period_months integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ws_blanket_stale_days_check CHECK (blanket_stale_days > 0),
  CONSTRAINT ws_follow_up_days_check CHECK (follow_up_outstanding_days > 0),
  CONSTRAINT ws_grace_months_check CHECK (grace_period_months > 0)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE TRIGGER set_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_transaction_charges_updated_at
  BEFORE UPDATE ON public.transaction_charges
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_rent_accruals_updated_at
  BEFORE UPDATE ON public.rent_accruals
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_customer_receipts_updated_at
  BEFORE UPDATE ON public.customer_receipts
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_receipt_allocations_updated_at
  BEFORE UPDATE ON public.receipt_allocations
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_warehouse_settings_updated_at
  BEFORE UPDATE ON public.warehouse_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warehouse_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_accruals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_settings ENABLE ROW LEVEL SECURITY;

-- Tenants: visible if user has a role in that tenant
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (id = public.current_tenant_id());

-- Warehouses
CREATE POLICY warehouses_select ON public.warehouses
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY warehouses_insert ON public.warehouses
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY warehouses_update ON public.warehouses
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role IN ('OWNER', 'MANAGER')
    )
  );

-- Profiles
CREATE POLICY user_profiles_self_select ON public.user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY user_profiles_self_insert ON public.user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY user_profiles_self_update ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());

-- Roles: read own
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Assignments
CREATE POLICY uwa_select_own ON public.user_warehouse_assignments
  FOR SELECT USING (user_id = auth.uid());

-- Helper expression: warehouse in tenant + accessible
-- Customers
CREATE POLICY customers_select ON public.customers
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY customers_insert ON public.customers
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY customers_update ON public.customers
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

-- Products (tenant-wide catalog)
CREATE POLICY products_select ON public.products
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY products_insert ON public.products
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY products_update ON public.products
  FOR UPDATE USING (tenant_id = public.current_tenant_id());

-- Lots
CREATE POLICY lots_select ON public.lots
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY lots_insert ON public.lots
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY lots_update ON public.lots
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

-- Deliveries (via lot)
CREATE POLICY deliveries_select ON public.deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = deliveries.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY deliveries_insert ON public.deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = deliveries.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY deliveries_update ON public.deliveries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = deliveries.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- Transaction charges
CREATE POLICY transaction_charges_select ON public.transaction_charges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = transaction_charges.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY transaction_charges_insert ON public.transaction_charges
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = transaction_charges.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY transaction_charges_update ON public.transaction_charges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = transaction_charges.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- Rent accruals
CREATE POLICY rent_accruals_select ON public.rent_accruals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = rent_accruals.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY rent_accruals_insert ON public.rent_accruals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = rent_accruals.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY rent_accruals_update ON public.rent_accruals
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = rent_accruals.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- Customer receipts
CREATE POLICY customer_receipts_select ON public.customer_receipts
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY customer_receipts_insert ON public.customer_receipts
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY customer_receipts_update ON public.customer_receipts
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

-- Receipt allocations
CREATE POLICY receipt_allocations_select ON public.receipt_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_allocations.receipt_id
        AND r.tenant_id = public.current_tenant_id()
        AND r.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY receipt_allocations_insert ON public.receipt_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_allocations.receipt_id
        AND r.tenant_id = public.current_tenant_id()
        AND r.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY receipt_allocations_update ON public.receipt_allocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.customer_receipts r
      WHERE r.id = receipt_allocations.receipt_id
        AND r.tenant_id = public.current_tenant_id()
        AND r.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- Audit log
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

-- Lot status history
CREATE POLICY lot_status_history_select ON public.lot_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = lot_status_history.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY lot_status_history_insert ON public.lot_status_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lots l
      WHERE l.id = lot_status_history.lot_id
        AND l.tenant_id = public.current_tenant_id()
        AND l.warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- Warehouse settings (OWNER)
CREATE POLICY warehouse_settings_select ON public.warehouse_settings
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role = 'OWNER'
    )
  );

CREATE POLICY warehouse_settings_insert ON public.warehouse_settings
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role = 'OWNER'
    )
  );

CREATE POLICY warehouse_settings_update ON public.warehouse_settings
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role = 'OWNER'
    )
  );

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accessible_warehouse_ids() TO authenticated;
