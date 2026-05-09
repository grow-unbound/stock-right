-- Extend customer_outstanding_allocatable with product + bag context for receipt allocation UI.

DROP FUNCTION IF EXISTS public.customer_outstanding_allocatable(uuid, uuid);
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
  remaining_amount numeric,
  product_name text,
  balance_bags integer,
  original_bags integer
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
      (ra.rental_amount - COALESCE(ral.sum_a, 0))::numeric(12, 2) AS rem_amt,
      pr.product_name AS pname,
      l.balance_bags AS bb,
      l.original_bags AS ob
    FROM public.rent_accruals ra
    INNER JOIN public.lots l ON l.id = ra.lot_id
    INNER JOIN public.products pr ON pr.id = l.product_id
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
      (tc.charge_amount - COALESCE(ral.sum_a, 0))::numeric(12, 2) AS rem_amt,
      pr.product_name AS pname,
      l.balance_bags AS bb,
      l.original_bags AS ob
    FROM public.transaction_charges tc
    INNER JOIN public.lots l ON l.id = tc.lot_id
    INNER JOIN public.products pr ON pr.id = l.product_id
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
    x.rem_amt AS remaining_amount,
    x.pname AS product_name,
    x.bb AS balance_bags,
    x.ob AS original_bags
  FROM (
    SELECT * FROM rent_lines
    UNION ALL
    SELECT * FROM charge_lines
  ) x
  ORDER BY x.sdt ASC, x.lk ASC, x.lid ASC;
$$;

COMMENT ON FUNCTION public.customer_outstanding_allocatable(uuid, uuid) IS
  'FIFO-ordered unpaid rent/charge lines with remaining balances after receipt allocations; includes lot product + bags for allocation UI.';
