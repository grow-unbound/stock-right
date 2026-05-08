-- Local development seed (runs after migrations on `supabase db reset`).
-- Uses fixed UUIDs so fixtures stay stable across resets.

BEGIN;

INSERT INTO public.tenants (id, name)
VALUES (
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Demo Cold Storage Co.'
  );

INSERT INTO public.warehouses (
  id,
  tenant_id,
  warehouse_name,
  warehouse_code,
  city,
  state,
  pincode,
  capacity_bags
)
VALUES (
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Demo Warehouse — Hyderabad',
    'WH-DEMO-HYD',
    'Hyderabad',
    'Telangana',
    '500001',
    10000
  );

INSERT INTO public.warehouse_settings (
  id,
  warehouse_id,
  tenant_id,
  blanket_stale_days,
  follow_up_outstanding_days,
  yearly_rent_cutoff_month,
  yearly_rent_cutoff_day,
  grace_period_months
)
VALUES (
    'a0000000-0000-4000-8000-000000000010'::uuid,
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    180,
    30,
    1,
    1,
    1
  );

INSERT INTO public.customers (
  id,
  warehouse_id,
  tenant_id,
  customer_code,
  customer_name,
  phone,
  mobile,
  category,
  address,
  gstin,
  credit_limit,
  notes,
  is_active
)
VALUES (
    'a0000000-0000-4000-8000-000000000003'::uuid,
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'DEMO/CUST1',
    'Demo Customer',
    '+919876543210',
    NULL,
    'TRADER',
    'Sample address',
    NULL,
    0,
    'Seed customer for local dev',
    true
  );

INSERT INTO public.product_groups (
  id,
  tenant_id,
  name,
  parent_product_group_id
)
VALUES (
    'a0000000-0000-4000-8000-000000000020'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Vegetables',
    NULL
  );

INSERT INTO public.charge_types (
  id,
  tenant_id,
  code,
  display_name,
  sort_order
)
VALUES
  (
    'a0000000-0000-4000-8000-000000000021'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'HAMALI',
    'Hamali',
    1
  ),
  (
    'a0000000-0000-4000-8000-000000000022'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'PLATFORM_HAMALI',
    'Platform Hamali',
    2
  ),
  (
    'a0000000-0000-4000-8000-000000000023'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'KATA_COOLIE',
    'Kata Coolie',
    3
  ),
  (
    'a0000000-0000-4000-8000-000000000024'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'MAMULLE',
    'Mamulle',
    4
  ),
  (
    'a0000000-0000-4000-8000-000000000025'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'TRANSPORT',
    'Transport',
    5
  ),
  (
    'a0000000-0000-4000-8000-000000000026'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'INSURANCE',
    'Insurance',
    6
  );

INSERT INTO public.locations (
  id,
  tenant_id,
  warehouse_id,
  name
)
VALUES (
    'a0000000-0000-4000-8000-000000000040'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'A1/12A'
  );

INSERT INTO public.products (
  id,
  tenant_id,
  product_name,
  product_group_id,
  chargeable_bag_size,
  monthly_rent_per_kg,
  yearly_rent_per_kg,
  stale_days_limit,
  storage_temperature,
  description,
  is_active
)
VALUES (
    'a0000000-0000-4000-8000-000000000004'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'Demo Potatoes (bags)',
    'a0000000-0000-4000-8000-000000000020'::uuid,
    50,
    2.5,
    25,
    90,
    '2–4°C',
    'Seed catalog row',
    true
  );

INSERT INTO public.product_charges (
  product_id,
  charge_type_id,
  charges_per_bag
)
VALUES (
    'a0000000-0000-4000-8000-000000000004'::uuid,
    'a0000000-0000-4000-8000-000000000021'::uuid,
    12.5
  );

INSERT INTO public.lots (
  id,
  lot_number,
  warehouse_id,
  tenant_id,
  customer_id,
  product_id,
  original_bags,
  balance_bags,
  lodgement_date,
  rental_mode,
  location_ids,
  driver_name,
  vehicle_number,
  status,
  notes
)
VALUES (
    'a0000000-0000-4000-8000-000000000005'::uuid,
    'DEMO100/100',
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    'a0000000-0000-4000-8000-000000000003'::uuid,
    'a0000000-0000-4000-8000-000000000004'::uuid,
    100,
    100,
    '2026-01-15',
    'MONTHLY',
    ARRAY['a0000000-0000-4000-8000-000000000040'::uuid],
    NULL,
    NULL,
    'ACTIVE',
    'Seed lot for UI dev'
  );

INSERT INTO public.customer_receipts (
  id,
  customer_id,
  warehouse_id,
  tenant_id,
  receipt_date,
  total_amount,
  payment_method,
  reference_number,
  notes,
  recorded_by
)
VALUES (
    'a0000000-0000-4000-8000-000000000030'::uuid,
    'a0000000-0000-4000-8000-000000000003'::uuid,
    'a0000000-0000-4000-8000-000000000002'::uuid,
    'a0000000-0000-4000-8000-000000000001'::uuid,
    '2026-02-01',
    5000.00,
    'CASH',
    'SEED-REF-1',
    'Seed receipt for Transactions tab',
    NULL
  );

COMMIT;
