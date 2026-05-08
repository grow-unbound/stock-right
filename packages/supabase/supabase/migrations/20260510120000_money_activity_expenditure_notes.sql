-- Money activity: COALESCE names; expenditure_head + notes for payments; search on new fields + short date.

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
  COALESCE(c.customer_name, '')::text AS counterparty_name,
  c.customer_code::text AS customer_code,
  r.reference_number::text AS reference_number,
  NULL::text AS payment_type_name,
  r.receipt_allocated,
  NULL::text AS expenditure_head,
  NULL::text AS notes
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
  NULL::boolean AS receipt_allocated,
  op.expenditure_head::text AS expenditure_head,
  op.notes::text AS notes
FROM public.operational_payments op
LEFT JOIN public.payment_types pt ON pt.id = op.payment_type_id
WHERE op.status = 'PAID'::public.op_payment_status;

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
          OR COALESCE(m.expenditure_head, '') ILIKE '%' || v_term || '%'
          OR COALESCE(m.notes, '') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'DD/MM/YYYY') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'FMdd Mon') ILIKE '%' || v_term || '%'
          OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'FMdd Mon YYYY') ILIKE '%' || v_term || '%'
        )
      )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.list_money_movements(uuid, text, text, text, text, integer, integer);

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
  receipt_allocated boolean,
  expenditure_head text,
  notes text
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
        m.receipt_allocated,
        m.expenditure_head,
        m.notes
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
            OR COALESCE(m.expenditure_head, '') ILIKE '%%' || $3 || '%%'
            OR COALESCE(m.notes, '') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'DD/MM/YYYY') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'FMdd Mon') ILIKE '%%' || $3 || '%%'
            OR to_char((m.occurred_at AT TIME ZONE 'UTC'), 'FMdd Mon YYYY') ILIKE '%%' || $3 || '%%'
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

GRANT EXECUTE ON FUNCTION public.list_money_movements(uuid, text, text, text, text, integer, integer) TO authenticated;
