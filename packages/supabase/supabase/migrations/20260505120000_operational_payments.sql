-- Reconstructed from live Supabase project grow-cold + MCP introspection.
-- Includes operational_payments, payment_types, op_payment_status, warehouse_snapshot,
-- daily_money_summary, sync trigger fn_sync_op_payment_to_summaries, RLS, indexes.

-- ---------------------------------------------------------------------------
-- 1. Enum
-- ---------------------------------------------------------------------------
CREATE TYPE public.op_payment_status AS ENUM (
  'PENDING',
  'PAID'
);

-- ---------------------------------------------------------------------------
-- 2. warehouse_snapshot
-- ---------------------------------------------------------------------------
CREATE TABLE public.warehouse_snapshot (
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id),
  total_bags integer NOT NULL DEFAULT 0,
  total_lots integer NOT NULL DEFAULT 0,
  active_lots integer NOT NULL DEFAULT 0,
  stale_lots integer NOT NULL DEFAULT 0,
  fresh_bags integer NOT NULL DEFAULT 0,
  fresh_lots integer NOT NULL DEFAULT 0,
  aging_bags integer NOT NULL DEFAULT 0,
  aging_lots integer NOT NULL DEFAULT 0,
  stale_bags integer NOT NULL DEFAULT 0,
  today_lodged_bags integer NOT NULL DEFAULT 0,
  today_lodged_lots integer NOT NULL DEFAULT 0,
  today_delivered_bags integer NOT NULL DEFAULT 0,
  today_delivered_lots integer NOT NULL DEFAULT 0,
  cash_balance numeric NOT NULL DEFAULT 0,
  today_receipts numeric NOT NULL DEFAULT 0,
  today_payments numeric NOT NULL DEFAULT 0,
  pending_payables numeric NOT NULL DEFAULT 0,
  today_receipt_parties integer NOT NULL DEFAULT 0,
  total_receivable numeric NOT NULL DEFAULT 0,
  receivable_customers integer NOT NULL DEFAULT 0,
  receivable_rents numeric NOT NULL DEFAULT 0,
  receivable_charges numeric NOT NULL DEFAULT 0,
  receivable_others numeric NOT NULL DEFAULT 0,
  rent_lots integer NOT NULL DEFAULT 0,
  charges_lots integer NOT NULL DEFAULT 0,
  overdue_customers integer NOT NULL DEFAULT 0,
  lots_aged_365_plus integer NOT NULL DEFAULT 0,
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  today_date date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (warehouse_id)
);

CREATE INDEX idx_warehouse_snapshot_tenant ON public.warehouse_snapshot USING btree (tenant_id);

ALTER TABLE public.warehouse_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_snapshot_select ON public.warehouse_snapshot FOR SELECT USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY warehouse_snapshot_insert ON public.warehouse_snapshot FOR INSERT WITH CHECK (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY warehouse_snapshot_update ON public.warehouse_snapshot FOR UPDATE USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

GRANT ALL ON public.warehouse_snapshot TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_snapshot TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. daily_money_summary
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_money_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id),
  summary_date date NOT NULL,
  receipts_amount numeric NOT NULL DEFAULT 0,
  receipts_count integer NOT NULL DEFAULT 0,
  receipt_parties integer NOT NULL DEFAULT 0,
  payments_amount numeric NOT NULL DEFAULT 0,
  payments_count integer NOT NULL DEFAULT 0,
  net_amount numeric,
  last_updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT daily_money_summary_warehouse_date_key UNIQUE (warehouse_id, summary_date)
);

CREATE INDEX idx_daily_money_warehouse_date ON public.daily_money_summary USING btree (warehouse_id, summary_date DESC);

ALTER TABLE public.daily_money_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_money_summary_select ON public.daily_money_summary FOR SELECT USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY daily_money_summary_insert ON public.daily_money_summary FOR INSERT WITH CHECK (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY daily_money_summary_update ON public.daily_money_summary FOR UPDATE USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

GRANT ALL ON public.daily_money_summary TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_money_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. payment_types
-- ---------------------------------------------------------------------------
CREATE TABLE public.payment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  CONSTRAINT payment_types_tenant_name_key UNIQUE (tenant_id, name),
  CONSTRAINT payment_types_category_check CHECK (
    category = ANY (
      ARRAY[
        'LABOR'::text,
        'STAFF'::text,
        'PLANT'::text,
        'OFFICE'::text,
        'FINANCE'::text,
        'PETTY_CASH'::text,
        'PARTY_TRANSPORT'::text,
        'STOCK_MOVEMENT'::text
      ]
    )
  )
);

CREATE INDEX idx_payment_types_tenant_id ON public.payment_types USING btree (tenant_id);

ALTER TABLE public.payment_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_types_select ON public.payment_types FOR SELECT USING (tenant_id = public.current_tenant_id ());

CREATE POLICY payment_types_insert ON public.payment_types FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id ());

CREATE POLICY payment_types_update ON public.payment_types FOR UPDATE USING (tenant_id = public.current_tenant_id ())
WITH
  CHECK (tenant_id = public.current_tenant_id ());

CREATE TRIGGER set_payment_types_updated_at BEFORE
UPDATE ON public.payment_types FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

GRANT ALL ON public.payment_types TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_types TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. operational_payments
-- ---------------------------------------------------------------------------
CREATE TABLE public.operational_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id () REFERENCES public.tenants (id),
  payment_type_id uuid REFERENCES public.payment_types (id),
  expenditure_head text,
  status public.op_payment_status NOT NULL DEFAULT 'PENDING'::public.op_payment_status,
  due_date date,
  payment_date date,
  amount numeric NOT NULL,
  payment_method public.payment_method,
  delivery_id uuid REFERENCES public.deliveries (id) ON DELETE SET NULL,
  lot_id uuid REFERENCES public.lots (id) ON DELETE SET NULL,
  party_name text,
  party_phone text,
  notes text,
  recorded_by uuid REFERENCES public.user_profiles (id),
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now (),
  external_reference_id text,
  CONSTRAINT operational_payments_amount_check CHECK (amount > (0)::numeric)
);

CREATE INDEX idx_op_payments_warehouse_date ON public.operational_payments USING btree (warehouse_id, payment_date DESC NULLS LAST);

CREATE INDEX idx_op_payments_warehouse_due ON public.operational_payments USING btree (warehouse_id, due_date)
WHERE
  status = 'PENDING'::public.op_payment_status;

CREATE INDEX idx_op_payments_warehouse_status ON public.operational_payments USING btree (warehouse_id, status);

CREATE INDEX idx_op_payments_lot ON public.operational_payments USING btree (lot_id)
WHERE
  lot_id IS NOT NULL;

CREATE INDEX idx_op_payments_delivery ON public.operational_payments USING btree (delivery_id)
WHERE
  delivery_id IS NOT NULL;

CREATE INDEX idx_op_payments_warehouse_payment_type ON public.operational_payments USING btree (warehouse_id, payment_type_id);

CREATE INDEX idx_op_payments_warehouse_external_ref ON public.operational_payments USING btree (warehouse_id, external_reference_id)
WHERE
  external_reference_id IS NOT NULL;

ALTER TABLE public.operational_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY operational_payments_select ON public.operational_payments FOR SELECT USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY operational_payments_insert ON public.operational_payments FOR INSERT WITH CHECK (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE POLICY operational_payments_update ON public.operational_payments FOR UPDATE USING (
  tenant_id = public.current_tenant_id ()
  AND warehouse_id IN ( SELECT public.accessible_warehouse_ids () AS accessible_warehouse_ids )
);

CREATE TRIGGER set_operational_payments_updated_at BEFORE
UPDATE ON public.operational_payments FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at ();

GRANT ALL ON public.operational_payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operational_payments TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Sync summaries
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sync_op_payment_to_summaries ()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
DECLARE
  v_today date := CURRENT_DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'PENDING'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        pending_payables = pending_payables + NEW.amount,
        last_updated_at = now()
      WHERE
        warehouse_id = NEW.warehouse_id;

    ELSIF NEW.status = 'PAID'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        cash_balance = cash_balance - NEW.amount,
        today_payments = CASE WHEN today_date = v_today THEN
          today_payments + NEW.amount
        ELSE
          NEW.amount
        END,
        today_date = v_today,
        last_updated_at = now()
      WHERE
        warehouse_id = NEW.warehouse_id;

      INSERT INTO public.daily_money_summary (warehouse_id, tenant_id, summary_date, payments_amount, payments_count)
        VALUES (NEW.warehouse_id, NEW.tenant_id, COALESCE(NEW.payment_date, v_today), NEW.amount, 1)
      ON CONFLICT (warehouse_id, summary_date)
        DO UPDATE SET
          payments_amount = public.daily_money_summary.payments_amount + EXCLUDED.payments_amount,
          payments_count = public.daily_money_summary.payments_count + 1,
          last_updated_at = now();

    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'PENDING'::public.op_payment_status
    AND NEW.status = 'PAID'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        pending_payables = GREATEST(0, pending_payables - NEW.amount),
        cash_balance = cash_balance - NEW.amount,
        today_payments = CASE WHEN today_date = v_today THEN
          today_payments + NEW.amount
        ELSE
          NEW.amount
        END,
        today_date = v_today,
        last_updated_at = now()
      WHERE
        warehouse_id = NEW.warehouse_id;

      INSERT INTO public.daily_money_summary (warehouse_id, tenant_id, summary_date, payments_amount, payments_count)
        VALUES (NEW.warehouse_id, NEW.tenant_id, COALESCE(NEW.payment_date, v_today), NEW.amount, 1)
      ON CONFLICT (warehouse_id, summary_date)
        DO UPDATE SET
          payments_amount = public.daily_money_summary.payments_amount + EXCLUDED.payments_amount,
          payments_count = public.daily_money_summary.payments_count + 1,
          last_updated_at = now();

    ELSIF OLD.status = 'PAID'::public.op_payment_status
    AND NEW.status = 'PENDING'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        pending_payables = pending_payables + NEW.amount,
        cash_balance = cash_balance + NEW.amount,
        last_updated_at = now()
      WHERE
        warehouse_id = NEW.warehouse_id;

    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'PENDING'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        pending_payables = GREATEST(0, pending_payables - OLD.amount),
        last_updated_at = now()
      WHERE
        warehouse_id = OLD.warehouse_id;

    ELSIF OLD.status = 'PAID'::public.op_payment_status THEN
      UPDATE public.warehouse_snapshot
      SET
        cash_balance = cash_balance + OLD.amount,
        last_updated_at = now()
      WHERE
        warehouse_id = OLD.warehouse_id;

    END IF;

  END IF;

  RETURN NULL;
END;

$function$;

CREATE TRIGGER trg_op_payment_sync_summaries
  AFTER INSERT OR DELETE OR UPDATE ON public.operational_payments FOR EACH ROW
EXECUTE PROCEDURE public.fn_sync_op_payment_to_summaries ();

COMMENT ON TABLE public.operational_payments IS 'Operational expenses (labor, transport, etc.). party_name/party_phone = payee.';

COMMENT ON COLUMN public.operational_payments.expenditure_head IS 'Optional label; payment_type_id is normalized category.';
