-- Stock tab: count + paginated/sorted list; stale rows = STALE status with balance > 0.
-- Replaces list_stock_movements(uuid,integer,date,timestamptz,text,uuid,text,text).

DROP FUNCTION IF EXISTS public.list_stock_movements(uuid, integer, date, timestamptz, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.count_stock_movements(
  p_warehouse_id uuid,
  p_search text DEFAULT NULL,
  p_filter text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  WITH needle AS (
    SELECT NULLIF(trim(both FROM coalesce(p_search, '')), '') AS q
  ),
  f AS (
    SELECT
      CASE lower(trim(both FROM coalesce(p_filter, 'all')))
        WHEN 'inward' THEN 'inward'
        WHEN 'outward' THEN 'outward'
        WHEN 'stale' THEN 'stale'
        ELSE 'all'
      END AS v
  ),
  rent_by_lot AS (
    SELECT
      ra.lot_id,
      coalesce(sum(ra.rental_amount), 0)::numeric(14, 2) AS rent_pending
    FROM public.rent_accruals ra
    WHERE NOT ra.is_paid
    GROUP BY ra.lot_id
  ),
  chg_by_lot AS (
    SELECT
      tc.lot_id,
      coalesce(sum(tc.charge_amount), 0)::numeric(14, 2) AS charges_pending
    FROM public.transaction_charges tc
    WHERE NOT tc.is_paid
    GROUP BY tc.lot_id
  ),
  merged AS (
    SELECT
      'lodgement'::text AS transaction_type,
      l.id AS event_id,
      l.id AS lot_id,
      l.lodgement_date::date AS tx_date,
      l.created_at,
      l.lot_number,
      l.original_bags AS num_bags,
      l.balance_bags,
      l.status::text AS lot_status,
      c.customer_code,
      c.customer_name,
      p.product_name,
      coalesce(rb.rent_pending, 0)::numeric(14, 2) AS rent_pending,
      coalesce(cb.charges_pending, 0)::numeric(14, 2) AS charges_pending
    FROM public.lots l
    INNER JOIN public.customers c ON c.id = l.customer_id
    INNER JOIN public.products p ON p.id = l.product_id
    LEFT JOIN rent_by_lot rb ON rb.lot_id = l.id
    LEFT JOIN chg_by_lot cb ON cb.lot_id = l.id
    CROSS JOIN needle
    CROSS JOIN f
    WHERE l.warehouse_id = p_warehouse_id
      AND (f.v <> 'outward')
      AND (
        needle.q IS NOT NULL
        OR l.status IN (
          'ACTIVE'::public.lot_status,
          'STALE'::public.lot_status,
          'DELIVERED'::public.lot_status
        )
      )
      AND (
        f.v <> 'stale'
        OR (
          l.status = 'STALE'::public.lot_status
          AND l.balance_bags > 0
        )
      )
      AND (
        needle.q IS NULL
        OR c.customer_code ILIKE '%' || needle.q || '%'
        OR c.customer_name ILIKE '%' || needle.q || '%'
        OR p.product_name ILIKE '%' || needle.q || '%'
        OR l.lot_number ILIKE '%' || needle.q || '%'
        OR l.lodgement_date::text ILIKE '%' || needle.q || '%'
        OR to_char(l.lodgement_date, 'DD Mon YYYY') ILIKE '%' || needle.q || '%'
        OR to_char(l.lodgement_date, 'YYYY-MM-DD') ILIKE '%' || needle.q || '%'
      )
    UNION ALL
    SELECT
      'delivery'::text,
      d.id,
      d.lot_id,
      d.delivery_date::date,
      d.created_at,
      l2.lot_number,
      d.num_bags_out,
      l2.balance_bags,
      l2.status::text,
      c2.customer_code,
      c2.customer_name,
      p2.product_name,
      coalesce(rb2.rent_pending, 0)::numeric(14, 2),
      coalesce(cb2.charges_pending, 0)::numeric(14, 2)
    FROM public.deliveries d
    INNER JOIN public.lots l2 ON l2.id = d.lot_id
    INNER JOIN public.customers c2 ON c2.id = l2.customer_id
    INNER JOIN public.products p2 ON p2.id = l2.product_id
    LEFT JOIN rent_by_lot rb2 ON rb2.lot_id = l2.id
    LEFT JOIN chg_by_lot cb2 ON cb2.lot_id = l2.id
    CROSS JOIN needle
    CROSS JOIN f
    WHERE l2.warehouse_id = p_warehouse_id
      AND (f.v <> 'inward')
      AND (
        needle.q IS NOT NULL
        OR l2.status IN (
          'ACTIVE'::public.lot_status,
          'STALE'::public.lot_status,
          'DELIVERED'::public.lot_status
        )
      )
      AND (
        f.v <> 'stale'
        OR (
          l2.status = 'STALE'::public.lot_status
          AND l2.balance_bags > 0
        )
      )
      AND (
        needle.q IS NULL
        OR c2.customer_code ILIKE '%' || needle.q || '%'
        OR c2.customer_name ILIKE '%' || needle.q || '%'
        OR p2.product_name ILIKE '%' || needle.q || '%'
        OR l2.lot_number ILIKE '%' || needle.q || '%'
        OR d.delivery_date::text ILIKE '%' || needle.q || '%'
        OR to_char(d.delivery_date, 'DD Mon YYYY') ILIKE '%' || needle.q || '%'
        OR to_char(d.delivery_date, 'YYYY-MM-DD') ILIKE '%' || needle.q || '%'
      )
  )
  SELECT count(*)::bigint FROM merged m;
$$;

CREATE OR REPLACE FUNCTION public.list_stock_movements(
  p_warehouse_id uuid,
  p_search text DEFAULT NULL,
  p_filter text DEFAULT NULL,
  p_sort_column text DEFAULT 'tx_date',
  p_sort_direction text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  transaction_type text,
  event_id uuid,
  lot_id uuid,
  tx_date date,
  created_at timestamptz,
  lot_number text,
  num_bags integer,
  balance_bags integer,
  lot_status text,
  customer_code text,
  customer_name text,
  product_name text,
  rent_pending numeric,
  charges_pending numeric
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
  v_sort_col text := lower(COALESCE(p_sort_column, 'tx_date'));
BEGIN
  IF v_sort_dir NOT IN ('asc', 'desc') THEN
    v_sort_dir := 'desc';
  END IF;

  IF v_sort_col NOT IN (
    'tx_date',
    'created_at',
    'lot_number',
    'transaction_type',
    'customer_code',
    'customer_name',
    'product_name',
    'num_bags',
    'balance_bags',
    'lot_status',
    'rent_pending',
    'charges_pending'
  ) THEN
    v_sort_col := 'tx_date';
  END IF;

  v_offset := (v_page_no - 1) * v_limit;

  RETURN QUERY
  EXECUTE
    $sql$
      WITH needle AS (
        SELECT NULLIF(trim(both FROM coalesce($1::text, '')), '') AS q
      ),
      f AS (
        SELECT
          CASE lower(trim(both FROM coalesce($2::text, 'all')))
            WHEN 'inward' THEN 'inward'
            WHEN 'outward' THEN 'outward'
            WHEN 'stale' THEN 'stale'
            ELSE 'all'
          END AS v
      ),
      rent_by_lot AS (
        SELECT
          ra.lot_id,
          coalesce(sum(ra.rental_amount), 0)::numeric(14, 2) AS rent_pending
        FROM public.rent_accruals ra
        WHERE NOT ra.is_paid
        GROUP BY ra.lot_id
      ),
      chg_by_lot AS (
        SELECT
          tc.lot_id,
          coalesce(sum(tc.charge_amount), 0)::numeric(14, 2) AS charges_pending
        FROM public.transaction_charges tc
        WHERE NOT tc.is_paid
        GROUP BY tc.lot_id
      ),
      merged AS (
        SELECT
          'lodgement'::text AS transaction_type,
          l.id AS event_id,
          l.id AS lot_id,
          l.lodgement_date::date AS tx_date,
          l.created_at,
          l.lot_number,
          l.original_bags AS num_bags,
          l.balance_bags,
          l.status::text AS lot_status,
          c.customer_code,
          c.customer_name,
          p.product_name,
          coalesce(rb.rent_pending, 0)::numeric(14, 2) AS rent_pending,
          coalesce(cb.charges_pending, 0)::numeric(14, 2) AS charges_pending
        FROM public.lots l
        INNER JOIN public.customers c ON c.id = l.customer_id
        INNER JOIN public.products p ON p.id = l.product_id
        LEFT JOIN rent_by_lot rb ON rb.lot_id = l.id
        LEFT JOIN chg_by_lot cb ON cb.lot_id = l.id
        CROSS JOIN needle
        CROSS JOIN f
        WHERE l.warehouse_id = $3::uuid
          AND (f.v <> 'outward')
          AND (
            needle.q IS NOT NULL
            OR l.status IN (
              'ACTIVE'::public.lot_status,
              'STALE'::public.lot_status,
              'DELIVERED'::public.lot_status
            )
          )
          AND (
            f.v <> 'stale'
            OR (
              l.status = 'STALE'::public.lot_status
              AND l.balance_bags > 0
            )
          )
          AND (
            needle.q IS NULL
            OR c.customer_code ILIKE '%%' || needle.q || '%%'
            OR c.customer_name ILIKE '%%' || needle.q || '%%'
            OR p.product_name ILIKE '%%' || needle.q || '%%'
            OR l.lot_number ILIKE '%%' || needle.q || '%%'
            OR l.lodgement_date::text ILIKE '%%' || needle.q || '%%'
            OR to_char(l.lodgement_date, 'DD Mon YYYY') ILIKE '%%' || needle.q || '%%'
            OR to_char(l.lodgement_date, 'YYYY-MM-DD') ILIKE '%%' || needle.q || '%%'
          )
        UNION ALL
        SELECT
          'delivery'::text,
          d.id,
          d.lot_id,
          d.delivery_date::date,
          d.created_at,
          l2.lot_number,
          d.num_bags_out,
          l2.balance_bags,
          l2.status::text,
          c2.customer_code,
          c2.customer_name,
          p2.product_name,
          coalesce(rb2.rent_pending, 0)::numeric(14, 2),
          coalesce(cb2.charges_pending, 0)::numeric(14, 2)
        FROM public.deliveries d
        INNER JOIN public.lots l2 ON l2.id = d.lot_id
        INNER JOIN public.customers c2 ON c2.id = l2.customer_id
        INNER JOIN public.products p2 ON p2.id = l2.product_id
        LEFT JOIN rent_by_lot rb2 ON rb2.lot_id = l2.id
        LEFT JOIN chg_by_lot cb2 ON cb2.lot_id = l2.id
        CROSS JOIN needle
        CROSS JOIN f
        WHERE l2.warehouse_id = $3::uuid
          AND (f.v <> 'inward')
          AND (
            needle.q IS NOT NULL
            OR l2.status IN (
              'ACTIVE'::public.lot_status,
              'STALE'::public.lot_status,
              'DELIVERED'::public.lot_status
            )
          )
          AND (
            f.v <> 'stale'
            OR (
              l2.status = 'STALE'::public.lot_status
              AND l2.balance_bags > 0
            )
          )
          AND (
            needle.q IS NULL
            OR c2.customer_code ILIKE '%%' || needle.q || '%%'
            OR c2.customer_name ILIKE '%%' || needle.q || '%%'
            OR p2.product_name ILIKE '%%' || needle.q || '%%'
            OR l2.lot_number ILIKE '%%' || needle.q || '%%'
            OR d.delivery_date::text ILIKE '%%' || needle.q || '%%'
            OR to_char(d.delivery_date, 'DD Mon YYYY') ILIKE '%%' || needle.q || '%%'
            OR to_char(d.delivery_date, 'YYYY-MM-DD') ILIKE '%%' || needle.q || '%%'
          )
      )
      SELECT
        m.transaction_type,
        m.event_id,
        m.lot_id,
        m.tx_date,
        m.created_at,
        m.lot_number,
        m.num_bags,
        m.balance_bags,
        m.lot_status,
        m.customer_code,
        m.customer_name,
        m.product_name,
        m.rent_pending,
        m.charges_pending
      FROM merged m
      ORDER BY
        CASE WHEN $4::text = 'tx_date' AND $5::text = 'asc' THEN m.tx_date END ASC NULLS LAST,
        CASE WHEN $4::text = 'tx_date' AND $5::text = 'desc' THEN m.tx_date END DESC NULLS LAST,
        CASE WHEN $4::text = 'created_at' AND $5::text = 'asc' THEN m.created_at END ASC NULLS LAST,
        CASE WHEN $4::text = 'created_at' AND $5::text = 'desc' THEN m.created_at END DESC NULLS LAST,
        CASE WHEN $4::text = 'lot_number' AND $5::text = 'asc' THEN m.lot_number END ASC NULLS LAST,
        CASE WHEN $4::text = 'lot_number' AND $5::text = 'desc' THEN m.lot_number END DESC NULLS LAST,
        CASE WHEN $4::text = 'transaction_type' AND $5::text = 'asc' THEN m.transaction_type END ASC NULLS LAST,
        CASE WHEN $4::text = 'transaction_type' AND $5::text = 'desc' THEN m.transaction_type END DESC NULLS LAST,
        CASE WHEN $4::text = 'customer_code' AND $5::text = 'asc' THEN m.customer_code END ASC NULLS LAST,
        CASE WHEN $4::text = 'customer_code' AND $5::text = 'desc' THEN m.customer_code END DESC NULLS LAST,
        CASE WHEN $4::text = 'customer_name' AND $5::text = 'asc' THEN m.customer_name END ASC NULLS LAST,
        CASE WHEN $4::text = 'customer_name' AND $5::text = 'desc' THEN m.customer_name END DESC NULLS LAST,
        CASE WHEN $4::text = 'product_name' AND $5::text = 'asc' THEN m.product_name END ASC NULLS LAST,
        CASE WHEN $4::text = 'product_name' AND $5::text = 'desc' THEN m.product_name END DESC NULLS LAST,
        CASE WHEN $4::text = 'num_bags' AND $5::text = 'asc' THEN m.num_bags END ASC NULLS LAST,
        CASE WHEN $4::text = 'num_bags' AND $5::text = 'desc' THEN m.num_bags END DESC NULLS LAST,
        CASE WHEN $4::text = 'balance_bags' AND $5::text = 'asc' THEN m.balance_bags END ASC NULLS LAST,
        CASE WHEN $4::text = 'balance_bags' AND $5::text = 'desc' THEN m.balance_bags END DESC NULLS LAST,
        CASE WHEN $4::text = 'lot_status' AND $5::text = 'asc' THEN m.lot_status END ASC NULLS LAST,
        CASE WHEN $4::text = 'lot_status' AND $5::text = 'desc' THEN m.lot_status END DESC NULLS LAST,
        CASE WHEN $4::text = 'rent_pending' AND $5::text = 'asc' THEN m.rent_pending END ASC NULLS LAST,
        CASE WHEN $4::text = 'rent_pending' AND $5::text = 'desc' THEN m.rent_pending END DESC NULLS LAST,
        CASE WHEN $4::text = 'charges_pending' AND $5::text = 'asc' THEN m.charges_pending END ASC NULLS LAST,
        CASE WHEN $4::text = 'charges_pending' AND $5::text = 'desc' THEN m.charges_pending END DESC NULLS LAST,
        m.tx_date DESC NULLS LAST,
        m.created_at DESC NULLS LAST,
        m.transaction_type ASC NULLS LAST,
        m.event_id ASC NULLS LAST
      LIMIT $6 OFFSET $7
    $sql$
  USING v_term,
    p_filter,
    p_warehouse_id,
    v_sort_col,
    v_sort_dir,
    v_limit,
    v_offset;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.count_stock_movements(uuid, text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.list_stock_movements(uuid, text, text, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.stock_tab_stale_kpis(p_warehouse_id uuid)
RETURNS TABLE (stale_bags bigint, stale_lots bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  SELECT
    coalesce(sum(l.balance_bags), 0)::bigint AS stale_bags,
    count(*)::bigint AS stale_lots
  FROM public.lots l
  WHERE l.warehouse_id = p_warehouse_id
    AND l.status = 'STALE'::public.lot_status
    AND l.balance_bags > 0;
$$;

GRANT EXECUTE ON FUNCTION public.stock_tab_stale_kpis(uuid) TO authenticated;
