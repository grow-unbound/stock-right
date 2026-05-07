-- Form 5: outstanding dues for FIFO allocation + atomic confirm_receipt_allocations.
-- Adds allocation_confirmed_at on customer_receipts to distinguish "Later" vs confirmed credit-only.

ALTER TABLE public.customer_receipts
  ADD COLUMN IF NOT EXISTS allocation_confirmed_at timestamptz;

COMMENT ON COLUMN public.customer_receipts.allocation_confirmed_at IS
  'Set when user confirms allocation (including credit-only with zero accrual lines). Null means allocation step not finalized.';

-- ---------------------------------------------------------------------------
-- Outstanding rent + charges for a party, with remaining balances after prior allocations.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_outstanding_allocatable(
  p_warehouse_id uuid,
  p_customer_id uuid
)
RETURNS TABLE (
  line_kind text,
  line_id uuid,
  lot_id uuid,
  lot_number text,
  line_label text,
  display_period text,
  charge_type_code text,
  rental_mode text,
  sort_date date,
  due_amount numeric,
  remaining_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gate AS (
    SELECT 1 AS ok
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.warehouse_id = p_warehouse_id
      AND c.tenant_id = public.current_tenant_id()
      AND p_warehouse_id IN (SELECT public.accessible_warehouse_ids())
  ),
  rent_lines AS (
    SELECT
      'rent'::text AS lk,
      ra.id AS lid,
      l.id AS lid2,
      l.lot_number AS lnum,
      'Rent'::text AS lbl,
      to_char(ra.accrual_from, 'FMMonth YYYY') AS dper,
      NULL::text AS ccode,
      ra.rental_mode::text AS rmode,
      ra.accrual_from AS sdt,
      ra.rental_amount AS due_amt,
      (ra.rental_amount - COALESCE(ral.sum_a, 0))::numeric(12, 2) AS rem_amt
    FROM public.rent_accruals ra
    INNER JOIN public.lots l ON l.id = ra.lot_id
    LEFT JOIN LATERAL (
      SELECT SUM(r.amount) AS sum_a
      FROM public.receipt_allocations r
      WHERE r.rent_accrual_id = ra.id
    ) ral ON true
    WHERE EXISTS (SELECT 1 FROM gate)
      AND l.customer_id = p_customer_id
      AND l.warehouse_id = p_warehouse_id
      AND ra.is_paid = false
      AND (ra.rental_amount - COALESCE(ral.sum_a, 0)) > 0
  ),
  charge_lines AS (
    SELECT
      'charge'::text AS lk,
      tc.id AS lid,
      l.id AS lid2,
      l.lot_number AS lnum,
      ct.display_name AS lbl,
      to_char(tc.charge_date, 'DD/MM/YYYY') AS dper,
      ct.code AS ccode,
      NULL::text AS rmode,
      tc.charge_date AS sdt,
      tc.charge_amount AS due_amt,
      (tc.charge_amount - COALESCE(ral.sum_a, 0))::numeric(12, 2) AS rem_amt
    FROM public.transaction_charges tc
    INNER JOIN public.lots l ON l.id = tc.lot_id
    INNER JOIN public.product_charges pc ON pc.product_charge_type_id = tc.product_charge_type_id
    INNER JOIN public.charge_types ct ON ct.id = pc.charge_type_id
    LEFT JOIN LATERAL (
      SELECT SUM(r.amount) AS sum_a
      FROM public.receipt_allocations r
      WHERE r.charge_id = tc.id
    ) ral ON true
    WHERE EXISTS (SELECT 1 FROM gate)
      AND l.customer_id = p_customer_id
      AND l.warehouse_id = p_warehouse_id
      AND tc.is_paid = false
      AND (tc.charge_amount - COALESCE(ral.sum_a, 0)) > 0
  )
  SELECT
    x.lk AS line_kind,
    x.lid AS line_id,
    x.lid2 AS lot_id,
    x.lnum AS lot_number,
    x.lbl AS line_label,
    x.dper AS display_period,
    x.ccode AS charge_type_code,
    x.rmode AS rental_mode,
    x.sdt AS sort_date,
    x.due_amt AS due_amount,
    x.rem_amt AS remaining_amount
  FROM (
    SELECT * FROM rent_lines
    UNION ALL
    SELECT * FROM charge_lines
  ) x
  ORDER BY x.sdt ASC, x.lk ASC, x.lid ASC;
$$;

-- ---------------------------------------------------------------------------
-- Confirm allocations for a receipt (single transaction). Idempotent guard via
-- allocation_confirmed_at IS NULL and no existing receipt_allocations rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_receipt_allocations(
  p_receipt_id uuid,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    updated_at = now()
  WHERE cr.id = p_receipt_id;

  RETURN jsonb_build_object(
    'receipt_id', p_receipt_id,
    'applied_total', to_jsonb(v_sum),
    'credit_remaining', to_jsonb(v_cr.total_amount - v_sum)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_outstanding_allocatable(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_receipt_allocations(uuid, jsonb) TO authenticated;
