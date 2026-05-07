-- Paginated union of lodgements (lots) and deliveries for the Stock tab timeline.
CREATE OR REPLACE FUNCTION public.list_stock_movements(
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
  lot_id uuid,
  tx_date date,
  created_at timestamptz,
  lot_number text,
  num_bags integer,
  customer_code text,
  customer_name text,
  product_name text,
  product_group_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH merged AS (
    SELECT
      'lodgement'::text AS kind,
      l.id AS event_id,
      l.id AS lot_id,
      l.lodgement_date::date AS tx_date,
      l.created_at,
      l.lot_number,
      l.original_bags AS num_bags,
      c.customer_code,
      c.customer_name,
      p.product_name,
      COALESCE(pg.name, '')::text AS product_group_name
    FROM public.lots l
    INNER JOIN public.customers c ON c.id = l.customer_id
    INNER JOIN public.products p ON p.id = l.product_id
    LEFT JOIN public.product_groups pg ON pg.id = p.product_group_id
    WHERE l.warehouse_id = p_warehouse_id
    UNION ALL
    SELECT
      'delivery'::text,
      d.id,
      d.lot_id,
      d.delivery_date::date,
      d.created_at,
      l2.lot_number,
      d.num_bags_out,
      c2.customer_code,
      c2.customer_name,
      p2.product_name,
      COALESCE(pg2.name, '')::text
    FROM public.deliveries d
    INNER JOIN public.lots l2 ON l2.id = d.lot_id
    INNER JOIN public.customers c2 ON c2.id = l2.customer_id
    INNER JOIN public.products p2 ON p2.id = l2.product_id
    LEFT JOIN public.product_groups pg2 ON pg2.id = p2.product_group_id
    WHERE l2.warehouse_id = p_warehouse_id
  )
  SELECT
    m.kind,
    m.event_id,
    m.lot_id,
    m.tx_date,
    m.created_at,
    m.lot_number,
    m.num_bags,
    m.customer_code,
    m.customer_name,
    m.product_name,
    m.product_group_name
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

GRANT EXECUTE ON FUNCTION public.list_stock_movements(
  uuid,
  integer,
  date,
  timestamptz,
  text,
  uuid
) TO authenticated;
