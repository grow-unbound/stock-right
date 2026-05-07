-- Parties tab: receivables summary + paginated customer list (filters, search, sorts).
-- others_* columns are 0 until customer.other_pending exists in schema (see shared parties-tab TODO).

CREATE OR REPLACE FUNCTION public.parties_receivables_summary(p_warehouse_id uuid)
RETURNS TABLE (
  total_receivable numeric,
  customers_with_dues bigint,
  rent_receivable numeric,
  rent_lot_count bigint,
  charges_receivable numeric,
  charges_lot_count bigint,
  others_receivable numeric,
  others_customer_count bigint,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH eligible_lots AS (
    SELECT id, customer_id
    FROM public.lots
    WHERE warehouse_id = p_warehouse_id
      AND status <> 'WRITTEN_OFF'
  ),
  rent_agg AS (
    SELECT
      COALESCE(SUM(ra.rental_amount), 0)::numeric AS total,
      COUNT(DISTINCT ra.lot_id)::bigint AS lot_cnt
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
  ),
  chg_agg AS (
    SELECT
      COALESCE(SUM(tc.charge_amount), 0)::numeric AS total,
      COUNT(DISTINCT tc.lot_id)::bigint AS lot_cnt
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
  ),
  rent_by_cust AS (
    SELECT el.customer_id, SUM(ra.rental_amount)::numeric AS s
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
    GROUP BY el.customer_id
  ),
  chg_by_cust AS (
    SELECT el.customer_id, SUM(tc.charge_amount)::numeric AS s
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
    GROUP BY el.customer_id
  ),
  cust_ids AS (
    SELECT id
    FROM public.customers
    WHERE warehouse_id = p_warehouse_id
  ),
  outst AS (
    SELECT
      c.id,
      COALESCE(r.s, 0) + COALESCE(ch.s, 0) AS amt
    FROM cust_ids c
    LEFT JOIN rent_by_cust r ON r.customer_id = c.id
    LEFT JOIN chg_by_cust ch ON ch.customer_id = c.id
  )
  SELECT
    (SELECT total FROM rent_agg) + (SELECT total FROM chg_agg) AS total_receivable,
    (SELECT COUNT(*)::bigint FROM outst WHERE amt > 0) AS customers_with_dues,
    (SELECT total FROM rent_agg) AS rent_receivable,
    (SELECT lot_cnt FROM rent_agg) AS rent_lot_count,
    (SELECT total FROM chg_agg) AS charges_receivable,
    (SELECT lot_cnt FROM chg_agg) AS charges_lot_count,
    0::numeric AS others_receivable,
    0::bigint AS others_customer_count,
    now() AS updated_at;
$$;

CREATE OR REPLACE FUNCTION public.list_parties_tab(
  p_warehouse_id uuid,
  p_filter text DEFAULT 'active',
  p_search text DEFAULT '',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  customer_id uuid,
  customer_code text,
  customer_name text,
  phone text,
  mobile text,
  address text,
  outstanding numeric,
  lot_count bigint,
  bag_count bigint,
  last_activity_date date,
  has_stock boolean,
  filter_total bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH
  f AS (
    SELECT
      CASE lower(trim(both from coalesce(p_filter, 'active')))
        WHEN 'all' THEN 'all'
        WHEN 'active' THEN 'active'
        WHEN 'pending' THEN 'pending'
        WHEN 'pending_dues' THEN 'pending'
        ELSE 'active'
      END AS v
  ),
  lim AS (SELECT least(greatest(coalesce(p_limit, 50), 1), 100)::integer AS n),
  off AS (SELECT greatest(coalesce(p_offset, 0), 0)::integer AS n),
  needle AS (SELECT nullif(trim(both from coalesce(p_search, '')), '')::text AS q),
  eligible_lots AS (
    SELECT id, customer_id, balance_bags, status, lodgement_date
    FROM public.lots
    WHERE warehouse_id = p_warehouse_id
      AND status <> 'WRITTEN_OFF'
  ),
  rent_unpaid AS (
    SELECT el.customer_id, SUM(ra.rental_amount)::numeric AS rent_sum
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
    GROUP BY el.customer_id
  ),
  chg_unpaid AS (
    SELECT el.customer_id, SUM(tc.charge_amount)::numeric AS chg_sum
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
    GROUP BY el.customer_id
  ),
  lot_stats AS (
    SELECT
      el.customer_id,
      COUNT(*)::bigint AS lot_count,
      COALESCE(SUM(el.balance_bags), 0)::bigint AS bag_count
    FROM eligible_lots el
    GROUP BY el.customer_id
  ),
  has_stock AS (
    SELECT DISTINCT l.customer_id
    FROM public.lots l
    WHERE l.warehouse_id = p_warehouse_id
      AND l.status IN ('ACTIVE', 'STALE')
      AND l.balance_bags > 0
  ),
  last_lodge AS (
    SELECT l.customer_id, MAX(l.lodgement_date)::date AS d
    FROM public.lots l
    WHERE l.warehouse_id = p_warehouse_id
    GROUP BY l.customer_id
  ),
  last_del AS (
    SELECT l.customer_id, MAX(d.delivery_date)::date AS d
    FROM public.deliveries d
    INNER JOIN public.lots l ON l.id = d.lot_id
    WHERE l.warehouse_id = p_warehouse_id
    GROUP BY l.customer_id
  ),
  last_rec AS (
    SELECT r.customer_id, MAX(r.receipt_date)::date AS d
    FROM public.customer_receipts r
    WHERE r.warehouse_id = p_warehouse_id
    GROUP BY r.customer_id
  ),
  combined AS (
    SELECT
      c.id AS cid,
      c.customer_code,
      c.customer_name,
      c.phone,
      c.mobile,
      c.address,
      (COALESCE(ru.rent_sum, 0) + COALESCE(cu.chg_sum, 0))::numeric AS outst,
      COALESCE(ls.lot_count, 0)::bigint AS lcnt,
      COALESCE(ls.bag_count, 0)::bigint AS bcnt,
      (
        SELECT max(u.d)
        FROM (
          SELECT ll.d
          FROM last_lodge ll
          WHERE ll.customer_id = c.id
          UNION ALL
          SELECT ld.d
          FROM last_del ld
          WHERE ld.customer_id = c.id
          UNION ALL
          SELECT lr.d
          FROM last_rec lr
          WHERE lr.customer_id = c.id
        ) u(d)
      ) AS act_date,
      EXISTS (SELECT 1 FROM has_stock h WHERE h.customer_id = c.id) AS hstock
    FROM public.customers c
    LEFT JOIN rent_unpaid ru ON ru.customer_id = c.id
    LEFT JOIN chg_unpaid cu ON cu.customer_id = c.id
    LEFT JOIN lot_stats ls ON ls.customer_id = c.id
    WHERE c.warehouse_id = p_warehouse_id
  ),
  filtered AS (
    SELECT c.*
    FROM combined c
    CROSS JOIN f
    CROSS JOIN needle
    WHERE
      (needle.q IS NULL
        OR c.customer_code ILIKE '%' || needle.q || '%'
        OR c.customer_name ILIKE '%' || needle.q || '%'
        OR coalesce(c.phone, '') ILIKE '%' || needle.q || '%'
        OR coalesce(c.mobile, '') ILIKE '%' || needle.q || '%'
        OR coalesce(c.address, '') ILIKE '%' || needle.q || '%')
      AND (f.v <> 'active' OR c.hstock OR (c.act_date IS NOT NULL AND c.act_date >= (CURRENT_DATE - 90)))
      AND (f.v <> 'pending' OR c.outst > 0)
  ),
  ranked AS (
    SELECT
      t.*,
      (SELECT count(*)::bigint FROM filtered) AS filter_total,
      row_number() over (
        ORDER BY
          CASE WHEN (SELECT f.v FROM f) = 'all' THEN lower(t.customer_name::text) END ASC NULLS LAST,
          CASE WHEN (SELECT f.v FROM f) = 'all' THEN t.customer_code::text END ASC,
          CASE WHEN (SELECT f.v FROM f) = 'active' THEN t.act_date END DESC NULLS LAST,
          CASE WHEN (SELECT f.v FROM f) = 'active' THEN lower(t.customer_name::text) END ASC NULLS LAST,
          CASE WHEN (SELECT f.v FROM f) = 'active' THEN t.customer_code::text END ASC,
          CASE WHEN (SELECT f.v FROM f) = 'pending' THEN t.outst END DESC,
          CASE WHEN (SELECT f.v FROM f) = 'pending' THEN lower(t.customer_name::text) END ASC NULLS LAST,
          CASE WHEN (SELECT f.v FROM f) = 'pending' THEN t.customer_code::text END ASC,
          t.cid
      ) AS rn
    FROM filtered t
  )
  SELECT
    r.cid AS customer_id,
    r.customer_code,
    r.customer_name,
    r.phone,
    r.mobile,
    r.address,
    r.outst AS outstanding,
    r.lcnt AS lot_count,
    r.bcnt AS bag_count,
    r.act_date AS last_activity_date,
    r.hstock AS has_stock,
    r.filter_total
  FROM ranked r
  CROSS JOIN lim
  CROSS JOIN off
  WHERE r.rn > off.n
    AND r.rn <= off.n + lim.n
  ORDER BY r.rn;
$$;

GRANT EXECUTE ON FUNCTION public.parties_receivables_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_parties_tab(uuid, text, text, integer, integer) TO authenticated;
