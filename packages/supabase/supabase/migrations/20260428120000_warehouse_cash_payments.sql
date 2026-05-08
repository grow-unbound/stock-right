-- Outgoing cash payments (staff/vendor) for the Money tab; mirrors customer_receipts shape.
CREATE TABLE public.warehouse_cash_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  payment_date date NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  payment_method public.payment_method,
  recipient_name text NOT NULL,
  notes text,
  recorded_by uuid REFERENCES public.user_profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_cash_payments_total_amount_check CHECK (total_amount > 0)
);

CREATE INDEX idx_warehouse_cash_payments_warehouse_id ON public.warehouse_cash_payments (warehouse_id);
CREATE INDEX idx_warehouse_cash_payments_wh_date ON public.warehouse_cash_payments (warehouse_id, payment_date DESC);

CREATE TRIGGER set_warehouse_cash_payments_updated_at
  BEFORE UPDATE ON public.warehouse_cash_payments
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

ALTER TABLE public.warehouse_cash_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY warehouse_cash_payments_select ON public.warehouse_cash_payments
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY warehouse_cash_payments_insert ON public.warehouse_cash_payments
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

CREATE POLICY warehouse_cash_payments_update ON public.warehouse_cash_payments
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
    AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  );

-- Unified Money tab feed: receipts + cash payments, keyset-paginated (same pattern as list_stock_movements).
CREATE OR REPLACE FUNCTION public.list_money_movements(
  p_warehouse_id uuid,
  p_limit integer DEFAULT 20,
  p_cursor_tx_date date DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_kind text DEFAULT NULL,
  p_cursor_event_id uuid DEFAULT NULL
)
RETURNS TABLE (
  kind text,
  event_id uuid,
  tx_date date,
  created_at timestamptz,
  total_amount numeric,
  payment_method text,
  counterparty text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH merged AS (
    SELECT
      'receipt'::text AS kind,
      r.id AS event_id,
      r.receipt_date::date AS tx_date,
      r.created_at,
      r.total_amount,
      r.payment_method::text AS payment_method,
      c.customer_name::text AS counterparty,
      r.notes::text AS notes
    FROM public.customer_receipts r
    INNER JOIN public.customers c ON c.id = r.customer_id
    WHERE r.warehouse_id = p_warehouse_id
    UNION ALL
    SELECT
      'payment'::text,
      p.id,
      p.payment_date::date,
      p.created_at,
      p.total_amount,
      p.payment_method::text,
      p.recipient_name::text,
      p.notes::text
    FROM public.warehouse_cash_payments p
    WHERE p.warehouse_id = p_warehouse_id
  )
  SELECT
    m.kind,
    m.event_id,
    m.tx_date,
    m.created_at,
    m.total_amount,
    m.payment_method,
    m.counterparty,
    m.notes
  FROM merged m
  WHERE
    p_cursor_tx_date IS NULL
    OR m.tx_date < p_cursor_tx_date
    OR (
      m.tx_date = p_cursor_tx_date
      AND m.created_at < p_cursor_created_at
    )
    OR (
      m.tx_date = p_cursor_tx_date
      AND m.created_at = p_cursor_created_at
      AND m.kind > p_cursor_kind
    )
    OR (
      m.tx_date = p_cursor_tx_date
      AND m.created_at = p_cursor_created_at
      AND m.kind = p_cursor_kind
      AND m.event_id > p_cursor_event_id
    )
  ORDER BY m.tx_date DESC, m.created_at DESC, m.kind ASC, m.event_id ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.list_money_movements(
  uuid,
  integer,
  date,
  timestamptz,
  text,
  uuid
) TO authenticated;
