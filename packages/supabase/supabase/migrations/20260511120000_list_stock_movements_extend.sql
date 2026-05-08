-- Stock tab: extend list_stock_movements (transaction_type, search/filter, balances, pending amounts).
-- Runs after money_tab_feed; replaces prior 6-arg signature.

DROP FUNCTION IF EXISTS public.list_stock_movements(uuid, integer, date, timestamptz, text, uuid);

CREATE OR REPLACE FUNCTION public.list_stock_movements(
  p_warehouse_id uuid,
  p_limit integer DEFAULT 20,
  p_cursor_tx_date date DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_transaction_type text DEFAULT NULL,
  p_cursor_event_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_filter text DEFAULT NULL
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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
      AND (f.v <> 'stale' OR l.status = 'STALE'::public.lot_status)
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
      AND (f.v <> 'stale' OR l2.status = 'STALE'::public.lot_status)
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
      AND m.transaction_type > p_cursor_transaction_type
    )
    OR (
      m.tx_date = p_cursor_tx_date
      AND m.created_at = p_cursor_created_at
      AND m.transaction_type = p_cursor_transaction_type
      AND m.event_id > p_cursor_event_id
    )
  ORDER BY m.tx_date DESC, m.created_at DESC, m.transaction_type ASC, m.event_id ASC
  LIMIT least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

GRANT EXECUTE ON FUNCTION public.list_stock_movements(
  uuid,
  integer,
  date,
  timestamptz,
  text,
  uuid,
  text,
  text
) TO authenticated;
