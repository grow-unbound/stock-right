#!/usr/bin/env python3
"""One-off helper to emit 20260507120000 migration SQL (embedded)."""
from pathlib import Path

MIGRATION = r'''-- Reverse-engineered from live Supabase project grow-cold (ref lezpukcoyrovuhjghozu) via MCP.
-- Idempotent for environments where objects already exist (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- Depends on warehouse_snapshot, daily_money_summary, lots, customers, customer_receipts, operational_payments, payment_types, deliveries.

-- ---------------------------------------------------------------------------
-- 1. customer_summary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_summary (
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id),
  active_lot_count integer NOT NULL DEFAULT 0,
  active_bag_count integer NOT NULL DEFAULT 0,
  fresh_lot_count integer NOT NULL DEFAULT 0,
  fresh_bag_count integer NOT NULL DEFAULT 0,
  aging_lot_count integer NOT NULL DEFAULT 0,
  aging_bag_count integer NOT NULL DEFAULT 0,
  stale_lot_count integer NOT NULL DEFAULT 0,
  stale_bag_count integer NOT NULL DEFAULT 0,
  outstanding_total numeric(14, 2) NOT NULL DEFAULT 0,
  outstanding_rents numeric(14, 2) NOT NULL DEFAULT 0,
  outstanding_charges numeric(14, 2) NOT NULL DEFAULT 0,
  outstanding_others numeric(14, 2) NOT NULL DEFAULT 0,
  total_paid numeric(14, 2) NOT NULL DEFAULT 0,
  last_activity_date date,
  first_transaction_date date,
  is_active boolean NOT NULL DEFAULT true,
  has_pending_dues boolean,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_summary_warehouse ON public.customer_summary USING btree (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_customer_summary_active ON public.customer_summary USING btree (warehouse_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customer_summary_last_activity ON public.customer_summary USING btree (warehouse_id, last_activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_customer_summary_outstanding ON public.customer_summary USING btree (warehouse_id, outstanding_total DESC);

ALTER TABLE public.customer_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_summary_select ON public.customer_summary;
CREATE POLICY customer_summary_select ON public.customer_summary FOR SELECT USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

DROP POLICY IF EXISTS customer_summary_insert ON public.customer_summary;
CREATE POLICY customer_summary_insert ON public.customer_summary FOR INSERT WITH CHECK (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

DROP POLICY IF EXISTS customer_summary_update ON public.customer_summary;
CREATE POLICY customer_summary_update ON public.customer_summary FOR UPDATE USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

GRANT ALL ON public.customer_summary TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. daily_stock_summary
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_stock_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id),
  summary_date date NOT NULL,
  lodged_bags integer NOT NULL DEFAULT 0,
  lodged_lots integer NOT NULL DEFAULT 0,
  delivered_bags integer NOT NULL DEFAULT 0,
  delivered_lots integer NOT NULL DEFAULT 0,
  active_lots_eod integer NOT NULL DEFAULT 0,
  total_bags_eod integer NOT NULL DEFAULT 0,
  fresh_lots_eod integer NOT NULL DEFAULT 0,
  fresh_bags_eod integer NOT NULL DEFAULT 0,
  aging_lots_eod integer NOT NULL DEFAULT 0,
  aging_bags_eod integer NOT NULL DEFAULT 0,
  stale_lots_eod integer NOT NULL DEFAULT 0,
  stale_bags_eod integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT daily_stock_summary_warehouse_date_key UNIQUE (warehouse_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_stock_warehouse_date ON public.daily_stock_summary USING btree (warehouse_id, summary_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stock_tenant_date ON public.daily_stock_summary USING btree (tenant_id, summary_date DESC);

ALTER TABLE public.daily_stock_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS daily_stock_summary_select ON public.daily_stock_summary;
CREATE POLICY daily_stock_summary_select ON public.daily_stock_summary FOR SELECT USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

DROP POLICY IF EXISTS daily_stock_summary_insert ON public.daily_stock_summary;
CREATE POLICY daily_stock_summary_insert ON public.daily_stock_summary FOR INSERT WITH CHECK (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

DROP POLICY IF EXISTS daily_stock_summary_update ON public.daily_stock_summary;
CREATE POLICY daily_stock_summary_update ON public.daily_stock_summary FOR UPDATE USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids ())
);

GRANT ALL ON public.daily_stock_summary TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_stock_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Views (regular views on live DB)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.stock_events AS
SELECT
  'LODGEMENT'::text AS event_type,
  l.id,
  l.warehouse_id,
  l.customer_id,
  l.lodgement_date AS event_date,
  l.original_bags AS num_bags,
  l.balance_bags,
  l.status::text AS status,
  NULL::uuid AS delivery_id
FROM public.lots l
UNION ALL
SELECT
  'DELIVERY'::text AS event_type,
  d.id,
  l2.warehouse_id,
  l2.customer_id,
  d.delivery_date AS event_date,
  d.num_bags_out AS num_bags,
  l2.balance_bags,
  l2.status::text AS status,
  d.id AS delivery_id
FROM public.deliveries d
JOIN public.lots l2 ON l2.id = d.lot_id;

CREATE OR REPLACE VIEW public.money_events AS
SELECT
  'RECEIPT'::text AS event_type,
  cr.id,
  cr.warehouse_id,
  cr.customer_id,
  cr.receipt_date AS event_date,
  cr.total_amount::numeric AS amount,
  cr.payment_method::text AS payment_method,
  NULL::uuid AS payment_type_id,
  NULL::text AS payment_type_name,
  NULL::text AS payment_type_category,
  NULL::text AS expenditure_head,
  NULL::text AS party_name,
  NULL::text AS status
FROM public.customer_receipts cr
UNION ALL
SELECT
  'PAYMENT'::text AS event_type,
  op.id,
  op.warehouse_id,
  NULL::uuid AS customer_id,
  COALESCE(op.payment_date, op.due_date, (op.created_at AT TIME ZONE 'UTC'::text)::date) AS event_date,
  op.amount,
  op.payment_method::text AS payment_method,
  op.payment_type_id,
  pt.name AS payment_type_name,
  pt.category AS payment_type_category,
  op.expenditure_head,
  op.party_name,
  op.status::text AS status
FROM public.operational_payments op
LEFT JOIN public.payment_types pt ON pt.id = op.payment_type_id;

GRANT SELECT ON public.stock_events TO authenticated, service_role;
GRANT SELECT ON public.money_events TO authenticated, service_role;
'''

out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260507120000_customer_summary_daily_stock_event_views.sql"
out.write_text(MIGRATION)
print("wrote", out)
