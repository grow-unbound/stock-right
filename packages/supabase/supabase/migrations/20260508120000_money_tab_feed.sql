-- Money tab: drop warehouse_cash_payments; schema additions; receipt rollup into daily_money_summary;
-- money_activity view + list_money_movements / count_money_movements RPCs; RLS tightening on KPI table.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. Drop legacy warehouse cash payments + old RPC
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.list_money_movements(uuid, integer, date, timestamptz, text, uuid);

DROP TABLE IF EXISTS public.warehouse_cash_payments;

-- ---------------------------------------------------------------------------
-- 2. Schema columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.operational_payments
  ADD COLUMN IF NOT EXISTS reference_number text;

COMMENT ON COLUMN public.operational_payments.reference_number IS 'Human-visible payment reference shown alongside receipts.reference_number.';

ALTER TABLE public.customer_receipts
  ADD COLUMN IF NOT EXISTS receipt_allocated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customer_receipts.receipt_allocated IS 'When false for receipts in Money lists, prompt the operator to allocate the receipt amount against dues.';

UPDATE public.customer_receipts cr
SET receipt_allocated = true
WHERE cr.allocation_confirmed_at IS NOT NULL
   OR EXISTS (SELECT 1 FROM public.receipt_allocations ra WHERE ra.receipt_id = cr.id);

CREATE INDEX IF NOT EXISTS idx_customer_receipts_wh_receipt_date ON public.customer_receipts (warehouse_id, receipt_date DESC);

CREATE INDEX IF NOT EXISTS idx_customers_wh_customer_code ON public.customers (warehouse_id, customer_code);
CREATE INDEX IF NOT EXISTS idx_customers_wh_customer_name_trgm ON public.customers USING gin (customer_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_op_payments_wh_party_trgm ON public.operational_payments USING gin (party_name gin_trgm_ops)
  WHERE status = 'PAID'::public.op_payment_status;

CREATE INDEX IF NOT EXISTS idx_op_payments_wh_reference_trgm ON public.operational_payments USING gin (reference_number gin_trgm_ops)
  WHERE reference_number IS NOT NULL AND status = 'PAID'::public.op_payment_status;

CREATE INDEX IF NOT EXISTS idx_cr_wh_reference_trgm ON public.customer_receipts USING gin (reference_number gin_trgm_ops)
  WHERE reference_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_types_tenant_name_trgm ON public.payment_types USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. Roll receipts into daily_money_summary (warehouse_snapshot already driven elsewhere)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_sync_customer_receipt_to_daily_money_summaries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_wh uuid;
  v_tenant uuid;
  v_day date;
  v_amt numeric(12, 2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_wh := NEW.warehouse_id;
    v_tenant := NEW.tenant_id;
    v_day := NEW.receipt_date;
    v_amt := NEW.total_amount;

    INSERT INTO public.daily_money_summary (
      warehouse_id,
      tenant_id,
      summary_date,
      receipts_amount,
      receipts_count,
      receipt_parties,
      net_amount,
      last_updated_at
    )
    VALUES (
      v_wh,
      v_tenant,
      v_day,
      v_amt,
      1,
      1,
      v_amt,
      now()
    )
    ON CONFLICT (warehouse_id, summary_date)
    DO UPDATE SET
      receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
      receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
      receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
      net_amount = public.daily_money_summary.net_amount + EXCLUDED.net_amount,
      last_updated_at = now();

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.receipt_date IS DISTINCT FROM NEW.receipt_date OR OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      INSERT INTO public.daily_money_summary (
        warehouse_id,
        tenant_id,
        summary_date,
        receipts_amount,
        receipts_count,
        receipt_parties,
        net_amount,
        last_updated_at
      )
      VALUES (
        OLD.warehouse_id,
        OLD.tenant_id,
        OLD.receipt_date,
        -OLD.total_amount,
        -1,
        -1,
        -OLD.total_amount,
        now()
      )
      ON CONFLICT (warehouse_id, summary_date)
      DO UPDATE SET
        receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
        receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
        receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
        net_amount = public.daily_money_summary.net_amount + EXCLUDED.net_amount,
        last_updated_at = now();

      INSERT INTO public.daily_money_summary (
        warehouse_id,
        tenant_id,
        summary_date,
        receipts_amount,
        receipts_count,
        receipt_parties,
        net_amount,
        last_updated_at
      )
      VALUES (
        NEW.warehouse_id,
        NEW.tenant_id,
        NEW.receipt_date,
        NEW.total_amount,
        1,
        1,
        NEW.total_amount,
        now()
      )
      ON CONFLICT (warehouse_id, summary_date)
      DO UPDATE SET
        receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
        receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
        receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
        net_amount = public.daily_money_summary.net_amount + EXCLUDED.net_amount,
        last_updated_at = now();

    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.daily_money_summary (
      warehouse_id,
      tenant_id,
      summary_date,
      receipts_amount,
      receipts_count,
      receipt_parties,
      net_amount,
      last_updated_at
    )
    VALUES (
      OLD.warehouse_id,
      OLD.tenant_id,
      OLD.receipt_date,
      -OLD.total_amount,
      -1,
      -1,
      -OLD.total_amount,
      now()
    )
    ON CONFLICT (warehouse_id, summary_date)
    DO UPDATE SET
      receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
      receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
      receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
      net_amount = public.daily_money_summary.net_amount + EXCLUDED.net_amount,
      last_updated_at = now();

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_customer_receipt_daily_money ON public.customer_receipts;

CREATE TRIGGER trg_customer_receipt_daily_money
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_receipts
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_customer_receipt_to_daily_money_summaries();

-- ---------------------------------------------------------------------------
-- 4. Role gate for Money surfaces
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_money()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = public.current_tenant_id()
      AND ur.role IN ('OWNER'::public.user_role, 'MANAGER'::public.user_role)
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_manage_money() TO authenticated;

DROP POLICY IF EXISTS daily_money_summary_select ON public.daily_money_summary;

CREATE POLICY daily_money_summary_select ON public.daily_money_summary FOR SELECT USING (
  tenant_id = public.current_tenant_id()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  AND public.user_can_manage_money()
);

-- ---------------------------------------------------------------------------
-- 5. Unified money_activity view (Security Invoker — underlying RLS applies)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.money_activity AS
SELECT
  'receipt'::text AS transaction_type,
  r.id AS event_id,
  r.warehouse_id,
  r.tenant_id,
  ((r.receipt_date::timestamp WITHOUT TIME ZONE + (r.created_at::time WITHOUT TIME ZONE)))::timestamptz AS occurred_at,
  r.created_at,
  r.total_amount AS amount,
  r.payment_method::text AS payment_method,
  c.customer_name AS counterparty_name,
  c.customer_code::text AS customer_code,
  r.reference_number::text AS reference_number,
  NULL::text AS payment_type_name,
  r.receipt_allocated
FROM public.customer_receipts r
INNER JOIN public.customers c ON c.id = r.customer_id
UNION ALL
SELECT
  'payment'::text AS transaction_type,
  op.id AS event_id,
  op.warehouse_id,
  op.tenant_id,
  (
    (COALESCE(op.payment_date, op.created_at::date)::timestamp WITHOUT TIME ZONE + (op.created_at::time WITHOUT TIME ZONE))
  )::timestamptz AS occurred_at,
  op.created_at,
  op.amount AS amount,
  op.payment_method::text AS payment_method,
  COALESCE(op.party_name, '')::text AS counterparty_name,
  NULL::text AS customer_code,
  op.reference_number::text AS reference_number,
  pt.name::text AS payment_type_name,
  NULL::boolean AS receipt_allocated
FROM public.operational_payments op
LEFT JOIN public.payment_types pt ON pt.id = op.payment_type_id
WHERE op.status = 'PAID'::public.op_payment_status;

-- ---------------------------------------------------------------------------
-- 6. Patch confirm_receipt_allocations to flip receipt_allocated
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_receipt_allocations(
  p_receipt_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cr public.customer_receipts%ROWTYPE;
  elem jsonb;
  v_sum numeric(12, 2) := 0;
  v_line numeric(12, 2);
  v_rid uuid;
  v_cid uuid;
  v_rem numeric(12, 2);
  v_lot_customer uuid;
  v_affected_rent uuid[] := '{}';
  v_affected_charge uuid[] := '{}';
  ra_id uuid;
  ch_id uuid;
  v_tot numeric(12, 2);
  v_due numeric(12, 2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_cr
  FROM public.customer_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RECEIPT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_cr.tenant_id <> public.current_tenant_id() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_cr.warehouse_id NOT IN (SELECT public.accessible_warehouse_ids()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_cr.allocation_confirmed_at IS NOT NULL THEN
    RAISE EXCEPTION 'ALLOCATION_ALREADY_CONFIRMED' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.receipt_allocations r WHERE r.receipt_id = p_receipt_id) THEN
    RAISE EXCEPTION 'ALLOCATIONS_ALREADY_EXIST' USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(SUM((e ->> 'amount')::numeric), 0::numeric)
  INTO v_sum
  FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) AS e;

  IF v_sum > v_cr.total_amount THEN
    RAISE EXCEPTION 'ALLOCATION_EXCEEDS_RECEIPT' USING ERRCODE = '23514';
  END IF;

  FOR elem IN SELECT * FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb))
  LOOP
    v_rid := NULL;
    v_cid := NULL;

    IF elem ? 'rent_accrual_id'
       AND NULLIF(trim(elem ->> 'rent_accrual_id'), '') IS NOT NULL THEN
      v_rid := (elem ->> 'rent_accrual_id')::uuid;
    END IF;

    IF elem ? 'charge_id'
       AND NULLIF(trim(elem ->> 'charge_id'), '') IS NOT NULL THEN
      v_cid := (elem ->> 'charge_id')::uuid;
    END IF;

    IF (v_rid IS NULL AND v_cid IS NULL) OR (v_rid IS NOT NULL AND v_cid IS NOT NULL) THEN
      RAISE EXCEPTION 'INVALID_LINE_XOR' USING ERRCODE = '23514';
    END IF;

    v_line := (elem ->> 'amount')::numeric;
    IF v_line IS NULL OR v_line <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '23514';
    END IF;

    IF v_rid IS NOT NULL THEN
      SELECT
        ra.rental_amount - COALESCE((
          SELECT SUM(r.amount)
          FROM public.receipt_allocations r
          WHERE r.rent_accrual_id = ra.id
        ), 0),
        l.customer_id
      INTO v_rem, v_lot_customer
      FROM public.rent_accruals ra
      INNER JOIN public.lots l ON l.id = ra.lot_id
      WHERE ra.id = v_rid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'RENT_ACCRUAL_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;

      IF v_lot_customer <> v_cr.customer_id OR NOT EXISTS (
        SELECT 1 FROM public.lots l
        WHERE l.id = (SELECT lot_id FROM public.rent_accruals WHERE id = v_rid)
          AND l.warehouse_id = v_cr.warehouse_id
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
      END IF;

      IF v_line > v_rem THEN
        RAISE EXCEPTION 'OVER_ALLOCATION' USING ERRCODE = '23514';
      END IF;

      INSERT INTO public.receipt_allocations (
        receipt_id,
        rent_accrual_id,
        charge_id,
        amount,
        allocated_by,
        allocated_manually
      )
      VALUES (p_receipt_id, v_rid, NULL, v_line, v_uid, true);

      v_affected_rent := array_append(v_affected_rent, v_rid);
    ELSE
      SELECT
        tc.charge_amount - COALESCE((
          SELECT SUM(r.amount)
          FROM public.receipt_allocations r
          WHERE r.charge_id = tc.id
        ), 0),
        l.customer_id
      INTO v_rem, v_lot_customer
      FROM public.transaction_charges tc
      INNER JOIN public.lots l ON l.id = tc.lot_id
      WHERE tc.id = v_cid;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'CHARGE_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;

      IF v_lot_customer <> v_cr.customer_id OR NOT EXISTS (
        SELECT 1 FROM public.lots l
        WHERE l.id = (SELECT lot_id FROM public.transaction_charges WHERE id = v_cid)
          AND l.warehouse_id = v_cr.warehouse_id
      ) THEN
        RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
      END IF;

      IF v_line > v_rem THEN
        RAISE EXCEPTION 'OVER_ALLOCATION' USING ERRCODE = '23514';
      END IF;

      INSERT INTO public.receipt_allocations (
        receipt_id,
        rent_accrual_id,
        charge_id,
        amount,
        allocated_by,
        allocated_manually
      )
      VALUES (p_receipt_id, NULL, v_cid, v_line, v_uid, true);

      v_affected_charge := array_append(v_affected_charge, v_cid);
    END IF;
  END LOOP;

  FOR ra_id IN SELECT DISTINCT unnest(v_affected_rent)
  LOOP
    SELECT COALESCE(SUM(r.amount), 0::numeric), ra.rental_amount
    INTO v_tot, v_due
    FROM public.receipt_allocations r
    INNER JOIN public.rent_accruals ra ON ra.id = r.rent_accrual_id
    WHERE r.rent_accrual_id = ra_id
    GROUP BY ra.rental_amount;

    UPDATE public.rent_accruals ra
    SET
      is_paid = (v_tot >= ra.rental_amount),
      paid_date = CASE WHEN v_tot >= ra.rental_amount THEN v_cr.receipt_date ELSE NULL END,
      updated_at = now()
    WHERE ra.id = ra_id;
  END LOOP;

  FOR ch_id IN SELECT DISTINCT unnest(v_affected_charge)
  LOOP
    SELECT COALESCE(SUM(r.amount), 0::numeric), tc.charge_amount
    INTO v_tot, v_due
    FROM public.receipt_allocations r
    INNER JOIN public.transaction_charges tc ON tc.id = r.charge_id
    WHERE r.charge_id = ch_id
    GROUP BY tc.charge_amount;

    UPDATE public.transaction_charges tc
    SET
      is_paid = (v_tot >= tc.charge_amount),
      paid_date = CASE WHEN v_tot >= tc.charge_amount THEN v_cr.receipt_date ELSE NULL END,
      updated_at = now()
    WHERE tc.id = ch_id;
  END LOOP;

  UPDATE public.customer_receipts cr
  SET
    allocation_confirmed_at = now(),
    receipt_allocated = true,
    updated_at = now()
  WHERE cr.id = p_receipt_id;

  RETURN jsonb_build_object(
    'receipt_id', p_receipt_id,
    'applied_total', to_jsonb(v_sum),
    'credit_remaining', to_jsonb(v_cr.total_amount - v_sum)
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- 7. List + count RPCs (Owner/Manager only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.count_money_movements(
  p_warehouse_id uuid,
  p_search text DEFAULT NULL,
  p_transaction_type text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
DECLARE
  v_term text := NULLIF(trim(COALESCE(p_search, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.user_can_manage_money() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_warehouse_id IS NULL OR p_warehouse_id NOT IN (SELECT public.accessible_warehouse_ids()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(*)::bigint
    FROM public.money_activity m
    WHERE m.warehouse_id = p_warehouse_id
      AND (
        p_transaction_type IS NULL
        OR p_transaction_type = 'all'
        OR m.transaction_type = p_transaction_type
      )
      AND (
        v_term IS NULL
        OR (
          m.customer_code ILIKE '%' || v_term || '%'
          OR m.counterparty_name ILIKE '%' || v_term || '%'
          OR m.payment_method ILIKE '%' || v_term || '%'
          OR COALESCE(m.payment_type_name, '') ILIKE '%' || v_term || '%'
          OR COALESCE(m.reference_number, '') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'DD/MM/YYYY') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') ILIKE '%' || v_term || '%'
        )
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_money_movements(
  p_warehouse_id uuid,
  p_search text DEFAULT NULL,
  p_transaction_type text DEFAULT NULL,
  p_sort_column text DEFAULT 'occurred_at',
  p_sort_direction text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  transaction_type text,
  event_id uuid,
  occurred_at timestamptz,
  created_at timestamptz,
  amount numeric,
  payment_method text,
  counterparty_name text,
  customer_code text,
  reference_number text,
  payment_type_name text,
  receipt_allocated boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
DECLARE
  v_term text := NULLIF(trim(COALESCE(p_search, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_page_no integer := GREATEST(COALESCE(p_page, 1), 1);
  v_offset integer;
  v_sort_dir text := lower(COALESCE(p_sort_direction, 'desc'));
  v_sort_col text := lower(COALESCE(p_sort_column, 'occurred_at'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.user_can_manage_money() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_warehouse_id IS NULL OR p_warehouse_id NOT IN (SELECT public.accessible_warehouse_ids()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_sort_dir NOT IN ('asc', 'desc') THEN
    v_sort_dir := 'desc';
  END IF;

  IF v_sort_col NOT IN (
    'occurred_at',
    'created_at',
    'amount',
    'counterparty_name',
    'reference_number',
    'payment_method',
    'transaction_type'
  ) THEN
    v_sort_col := 'occurred_at';
  END IF;

  v_offset := (v_page_no - 1) * v_limit;

  RETURN QUERY EXECUTE format(
    $sql$
      SELECT
        m.transaction_type,
        m.event_id,
        m.occurred_at,
        m.created_at,
        m.amount,
        m.payment_method,
        m.counterparty_name,
        m.customer_code,
        m.reference_number,
        m.payment_type_name,
        m.receipt_allocated
      FROM public.money_activity m
      WHERE m.warehouse_id = $1
        AND (
          $2 IS NULL
          OR $2 = 'all'
          OR m.transaction_type = $2
        )
        AND (
          $3 IS NULL
          OR (
            m.customer_code ILIKE '%%' || $3 || '%%'
            OR m.counterparty_name ILIKE '%%' || $3 || '%%'
            OR m.payment_method ILIKE '%%' || $3 || '%%'
            OR COALESCE(m.payment_type_name, '') ILIKE '%%' || $3 || '%%'
            OR COALESCE(m.reference_number, '') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'DD/MM/YYYY') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') ILIKE '%%' || $3 || '%%'
          )
        )
      ORDER BY
        CASE WHEN $4 = 'occurred_at' AND $5 = 'asc' THEN m.occurred_at END ASC NULLS LAST,
        CASE WHEN $4 = 'occurred_at' AND $5 = 'desc' THEN m.occurred_at END DESC NULLS LAST,
        CASE WHEN $4 = 'created_at' AND $5 = 'asc' THEN m.created_at END ASC NULLS LAST,
        CASE WHEN $4 = 'created_at' AND $5 = 'desc' THEN m.created_at END DESC NULLS LAST,
        CASE WHEN $4 = 'amount' AND $5 = 'asc' THEN m.amount END ASC NULLS LAST,
        CASE WHEN $4 = 'amount' AND $5 = 'desc' THEN m.amount END DESC NULLS LAST,
        CASE WHEN $4 = 'counterparty_name' AND $5 = 'asc' THEN m.counterparty_name END ASC NULLS LAST,
        CASE WHEN $4 = 'counterparty_name' AND $5 = 'desc' THEN m.counterparty_name END DESC NULLS LAST,
        CASE WHEN $4 = 'reference_number' AND $5 = 'asc' THEN m.reference_number END ASC NULLS LAST,
        CASE WHEN $4 = 'reference_number' AND $5 = 'desc' THEN m.reference_number END DESC NULLS LAST,
        CASE WHEN $4 = 'payment_method' AND $5 = 'asc' THEN m.payment_method END ASC NULLS LAST,
        CASE WHEN $4 = 'payment_method' AND $5 = 'desc' THEN m.payment_method END DESC NULLS LAST,
        CASE WHEN $4 = 'transaction_type' AND $5 = 'asc' THEN m.transaction_type END ASC NULLS LAST,
        CASE WHEN $4 = 'transaction_type' AND $5 = 'desc' THEN m.transaction_type END DESC NULLS LAST,
        m.event_id ASC
      LIMIT $6 OFFSET $7
    $sql$
  )
  USING p_warehouse_id, p_transaction_type, v_term, v_sort_col, v_sort_dir, v_limit, v_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.count_money_movements(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_money_movements(uuid, text, text, text, text, integer, integer) TO authenticated;
