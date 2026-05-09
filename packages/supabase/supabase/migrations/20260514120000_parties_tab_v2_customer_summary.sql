-- Parties tab v2: KPIs, count, and paginated list aligned to customer_summary + accrual/lot fallbacks.
-- Replaces public.list_parties_tab(uuid, text, text, integer, integer) signature.

DROP FUNCTION IF EXISTS public.list_parties_tab(uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.parties_tab_kpis(p_warehouse_id uuid)
RETURNS TABLE (
  total_outstanding numeric,
  customers_with_outstanding bigint,
  stale_stock_bags bigint,
  parties_with_stale bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  WITH
  eligible_lots AS (
    SELECT l.id, l.customer_id, l.balance_bags, l.status
    FROM public.lots l
    WHERE l.warehouse_id = p_warehouse_id
      AND l.status <> 'WRITTEN_OFF'::public.lot_status
  ),
  rent_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(ra.rental_amount), 0)::numeric(14, 2) AS rent_sum
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
    GROUP BY el.customer_id
  ),
  chg_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(tc.charge_amount), 0)::numeric(14, 2) AS chg_sum
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
    GROUP BY el.customer_id
  ),
  lot_roll AS (
    SELECT
      el.customer_id,
      count(*) FILTER (
        WHERE el.status = 'ACTIVE'::public.lot_status
      )::integer AS lots_active,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status
      )::integer AS lots_stale,
      count(*) FILTER (
        WHERE el.status = 'DELIVERED'::public.lot_status
      )::integer AS lots_delivered,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status IN (
            'ACTIVE'::public.lot_status,
            'STALE'::public.lot_status,
            'DELIVERED'::public.lot_status
          )
        ),
        0
      )::bigint AS bags_asd,
      count(*) FILTER (
        WHERE el.status IN (
          'ACTIVE'::public.lot_status,
          'STALE'::public.lot_status,
          'DELIVERED'::public.lot_status
        )
      )::integer AS lots_asd,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
        ),
        0
      )::bigint AS stale_bags_live,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
      )::integer AS stale_lots_live
    FROM eligible_lots el
    GROUP BY el.customer_id
  ),
  combined AS (
    SELECT
      c.id AS cid,
      cs.outstanding_total,
      cs.outstanding_rents,
      cs.outstanding_charges,
      cs.fresh_lot_count,
      cs.fresh_bag_count,
      cs.aging_lot_count,
      cs.aging_bag_count,
      cs.stale_lot_count AS cs_stale_lots,
      cs.stale_bag_count AS cs_stale_bags,
      cs.is_active AS cs_is_active,
      coalesce(ru.rent_sum, 0)::numeric(14, 2) AS rent_live,
      coalesce(cu.chg_sum, 0)::numeric(14, 2) AS chg_live,
      lr.lots_active,
      lr.lots_stale,
      lr.lots_delivered,
      lr.bags_asd,
      lr.lots_asd,
      lr.stale_bags_live,
      lr.stale_lots_live
    FROM public.customers c
    LEFT JOIN public.customer_summary cs ON cs.customer_id = c.id
    LEFT JOIN rent_unpaid ru ON ru.customer_id = c.id
    LEFT JOIN chg_unpaid cu ON cu.customer_id = c.id
    LEFT JOIN lot_roll lr ON lr.customer_id = c.id
    WHERE c.warehouse_id = p_warehouse_id
  ),
  eff AS (
    SELECT
      coalesce(c.outstanding_total, c.rent_live + c.chg_live)::numeric(14, 2) AS outst,
      coalesce(c.outstanding_rents, c.rent_live)::numeric(14, 2) AS rents_eff,
      coalesce(c.outstanding_charges, c.chg_live)::numeric(14, 2) AS chg_eff,
      coalesce(c.cs_stale_lots, c.stale_lots_live, 0)::integer AS stale_lots_eff,
      coalesce(c.cs_stale_bags, c.stale_bags_live, 0)::bigint AS stale_bags_eff,
      CASE
        WHEN c.cs_is_active IS FALSE THEN false
        ELSE true
      END AS include_party
    FROM combined c
  )
  SELECT
    coalesce(sum(e.outst) FILTER (WHERE e.include_party), 0)::numeric(14, 2) AS total_outstanding,
    count(*) FILTER (WHERE e.include_party AND e.outst > 0)::bigint AS customers_with_outstanding,
    coalesce(
      sum(e.stale_bags_eff) FILTER (WHERE e.include_party),
      0
    )::bigint AS stale_stock_bags,
    count(*) FILTER (WHERE e.include_party AND e.stale_lots_eff > 0)::bigint AS parties_with_stale
  FROM eff e;
$$;

CREATE OR REPLACE FUNCTION public.count_parties_tab(
  p_warehouse_id uuid,
  p_filter text DEFAULT 'all',
  p_search text DEFAULT ''
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $$
  WITH
  needle AS (
    SELECT NULLIF(trim(both FROM coalesce(p_search, '')), '') AS q
  ),
  f AS (
    SELECT
      CASE lower(trim(both FROM coalesce(p_filter, 'all')))
        WHEN 'outstanding_due' THEN 'outstanding_due'
        WHEN 'stale_lots' THEN 'stale_lots'
        ELSE 'all'
      END AS v
  ),
  eligible_lots AS (
    SELECT l.id, l.customer_id, l.balance_bags, l.status
    FROM public.lots l
    WHERE l.warehouse_id = p_warehouse_id
      AND l.status <> 'WRITTEN_OFF'::public.lot_status
  ),
  rent_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(ra.rental_amount), 0)::numeric(14, 2) AS rent_sum
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
    GROUP BY el.customer_id
  ),
  chg_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(tc.charge_amount), 0)::numeric(14, 2) AS chg_sum
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
    GROUP BY el.customer_id
  ),
  lot_roll AS (
    SELECT
      el.customer_id,
      count(*) FILTER (
        WHERE el.status = 'ACTIVE'::public.lot_status
      )::integer AS lots_active,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status
      )::integer AS lots_stale,
      count(*) FILTER (
        WHERE el.status = 'DELIVERED'::public.lot_status
      )::integer AS lots_delivered,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status IN (
            'ACTIVE'::public.lot_status,
            'STALE'::public.lot_status,
            'DELIVERED'::public.lot_status
          )
        ),
        0
      )::bigint AS bags_asd,
      count(*) FILTER (
        WHERE el.status IN (
          'ACTIVE'::public.lot_status,
          'STALE'::public.lot_status,
          'DELIVERED'::public.lot_status
        )
      )::integer AS lots_asd,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
        ),
        0
      )::bigint AS stale_bags_live,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
      )::integer AS stale_lots_live
    FROM eligible_lots el
    GROUP BY el.customer_id
  ),
  combined AS (
    SELECT
      c.id AS cid,
      c.customer_code,
      c.customer_name,
      c.address,
      cs.outstanding_total,
      cs.outstanding_rents,
      cs.outstanding_charges,
      cs.fresh_lot_count,
      cs.fresh_bag_count,
      cs.aging_lot_count,
      cs.aging_bag_count,
      cs.stale_lot_count AS cs_stale_lots,
      cs.stale_bag_count AS cs_stale_bags,
      cs.is_active AS cs_is_active,
      coalesce(ru.rent_sum, 0)::numeric(14, 2) AS rent_live,
      coalesce(cu.chg_sum, 0)::numeric(14, 2) AS chg_live,
      lr.lots_active,
      lr.lots_stale,
      lr.lots_delivered,
      lr.bags_asd,
      lr.lots_asd,
      lr.stale_bags_live,
      lr.stale_lots_live
    FROM public.customers c
    LEFT JOIN public.customer_summary cs ON cs.customer_id = c.id
    LEFT JOIN rent_unpaid ru ON ru.customer_id = c.id
    LEFT JOIN chg_unpaid cu ON cu.customer_id = c.id
    LEFT JOIN lot_roll lr ON lr.customer_id = c.id
    CROSS JOIN needle
    CROSS JOIN f
    WHERE c.warehouse_id = p_warehouse_id
      AND (cs.customer_id IS NULL OR cs.is_active IS TRUE)
      AND (
        needle.q IS NULL
        OR c.customer_code ILIKE '%' || needle.q || '%'
        OR c.customer_name ILIKE '%' || needle.q || '%'
        OR coalesce(c.address, '') ILIKE '%' || needle.q || '%'
      )
  ),
  eff AS (
    SELECT
      c.cid,
      coalesce(c.outstanding_total, c.rent_live + c.chg_live)::numeric(14, 2) AS outst,
      coalesce(c.outstanding_rents, c.rent_live)::numeric(14, 2) AS rents_eff,
      coalesce(c.outstanding_charges, c.chg_live)::numeric(14, 2) AS chg_eff,
      coalesce(c.fresh_lot_count, 0)::integer AS fresh_lc,
      coalesce(c.fresh_bag_count, 0)::integer AS fresh_bc,
      coalesce(c.aging_lot_count, 0)::integer AS aging_lc,
      coalesce(c.aging_bag_count, 0)::integer AS aging_bc,
      coalesce(c.cs_stale_lots, c.stale_lots_live, 0)::integer AS stale_lc,
      coalesce(c.cs_stale_bags, c.stale_bags_live, 0)::integer AS stale_bc,
      coalesce(c.lots_active, 0)::integer AS lots_active,
      coalesce(c.lots_stale, 0)::integer AS lots_stale,
      coalesce(c.lots_delivered, 0)::integer AS lots_delivered,
      coalesce(c.bags_asd, 0)::bigint AS bags_asd,
      coalesce(c.lots_asd, 0)::integer AS lots_asd
    FROM combined c
    CROSS JOIN f
    WHERE
      (f.v <> 'outstanding_due' OR coalesce(c.outstanding_total, c.rent_live + c.chg_live) > 0)
      AND (
        f.v <> 'stale_lots'
        OR coalesce(c.cs_stale_lots, c.stale_lots_live, 0) > 0
      )
  )
  SELECT count(*)::bigint FROM eff;
$$;

CREATE OR REPLACE FUNCTION public.list_parties_tab(
  p_warehouse_id uuid,
  p_filter text DEFAULT 'all',
  p_search text DEFAULT '',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  customer_id uuid,
  customer_code text,
  customer_name text,
  address text,
  outstanding_total numeric,
  outstanding_rents numeric,
  outstanding_charges numeric,
  fresh_lot_count integer,
  fresh_bag_count integer,
  aging_lot_count integer,
  aging_bag_count integer,
  stale_lot_count integer,
  stale_bag_count integer,
  lots_active integer,
  lots_stale integer,
  lots_delivered integer,
  bags_active_stale_delivered bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path TO public
AS $function$
DECLARE
  v_limit integer := LEAST(GREATEST(coalesce(p_page_size, 20), 1), 100);
  v_page_no integer := GREATEST(coalesce(p_page, 1), 1);
  v_offset integer;
BEGIN
  v_offset := (v_page_no - 1) * v_limit;

  RETURN QUERY
  WITH
  needle AS (
    SELECT NULLIF(trim(both FROM coalesce(p_search, '')), '') AS q
  ),
  f AS (
    SELECT
      CASE lower(trim(both FROM coalesce(p_filter, 'all')))
        WHEN 'outstanding_due' THEN 'outstanding_due'
        WHEN 'stale_lots' THEN 'stale_lots'
        ELSE 'all'
      END AS v
  ),
  eligible_lots AS (
    SELECT l.id, l.customer_id, l.balance_bags, l.status
    FROM public.lots l
    WHERE l.warehouse_id = p_warehouse_id
      AND l.status <> 'WRITTEN_OFF'::public.lot_status
  ),
  rent_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(ra.rental_amount), 0)::numeric(14, 2) AS rent_sum
    FROM public.rent_accruals ra
    INNER JOIN eligible_lots el ON el.id = ra.lot_id
    WHERE NOT ra.is_paid
    GROUP BY el.customer_id
  ),
  chg_unpaid AS (
    SELECT
      el.customer_id,
      coalesce(sum(tc.charge_amount), 0)::numeric(14, 2) AS chg_sum
    FROM public.transaction_charges tc
    INNER JOIN eligible_lots el ON el.id = tc.lot_id
    WHERE NOT tc.is_paid
    GROUP BY el.customer_id
  ),
  lot_roll AS (
    SELECT
      el.customer_id,
      count(*) FILTER (
        WHERE el.status = 'ACTIVE'::public.lot_status
      )::integer AS lots_active,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status
      )::integer AS lots_stale,
      count(*) FILTER (
        WHERE el.status = 'DELIVERED'::public.lot_status
      )::integer AS lots_delivered,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status IN (
            'ACTIVE'::public.lot_status,
            'STALE'::public.lot_status,
            'DELIVERED'::public.lot_status
          )
        ),
        0
      )::bigint AS bags_asd,
      count(*) FILTER (
        WHERE el.status IN (
          'ACTIVE'::public.lot_status,
          'STALE'::public.lot_status,
          'DELIVERED'::public.lot_status
        )
      )::integer AS lots_asd,
      coalesce(
        sum(el.balance_bags) FILTER (
          WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
        ),
        0
      )::bigint AS stale_bags_live,
      count(*) FILTER (
        WHERE el.status = 'STALE'::public.lot_status AND el.balance_bags > 0
      )::integer AS stale_lots_live
    FROM eligible_lots el
    GROUP BY el.customer_id
  ),
  combined AS (
    SELECT
      c.id AS cid,
      c.customer_code,
      c.customer_name,
      c.address,
      cs.outstanding_total,
      cs.outstanding_rents,
      cs.outstanding_charges,
      cs.fresh_lot_count,
      cs.fresh_bag_count,
      cs.aging_lot_count,
      cs.aging_bag_count,
      cs.stale_lot_count AS cs_stale_lots,
      cs.stale_bag_count AS cs_stale_bags,
      cs.is_active AS cs_is_active,
      coalesce(ru.rent_sum, 0)::numeric(14, 2) AS rent_live,
      coalesce(cu.chg_sum, 0)::numeric(14, 2) AS chg_live,
      lr.lots_active,
      lr.lots_stale,
      lr.lots_delivered,
      lr.bags_asd,
      lr.lots_asd,
      lr.stale_bags_live,
      lr.stale_lots_live
    FROM public.customers c
    LEFT JOIN public.customer_summary cs ON cs.customer_id = c.id
    LEFT JOIN rent_unpaid ru ON ru.customer_id = c.id
    LEFT JOIN chg_unpaid cu ON cu.customer_id = c.id
    LEFT JOIN lot_roll lr ON lr.customer_id = c.id
    CROSS JOIN needle
    CROSS JOIN f
    WHERE c.warehouse_id = p_warehouse_id
      AND (cs.customer_id IS NULL OR cs.is_active IS TRUE)
      AND (
        needle.q IS NULL
        OR c.customer_code ILIKE '%' || needle.q || '%'
        OR c.customer_name ILIKE '%' || needle.q || '%'
        OR coalesce(c.address, '') ILIKE '%' || needle.q || '%'
      )
  ),
  filtered AS (
    SELECT
      c.cid,
      c.customer_code,
      c.customer_name,
      c.address,
      coalesce(c.outstanding_total, c.rent_live + c.chg_live)::numeric(14, 2) AS outst,
      coalesce(c.outstanding_rents, c.rent_live)::numeric(14, 2) AS rents_eff,
      coalesce(c.outstanding_charges, c.chg_live)::numeric(14, 2) AS chg_eff,
      coalesce(c.fresh_lot_count, 0)::integer AS fresh_lc,
      coalesce(c.fresh_bag_count, 0)::integer AS fresh_bc,
      coalesce(c.aging_lot_count, 0)::integer AS aging_lc,
      coalesce(c.aging_bag_count, 0)::integer AS aging_bc,
      coalesce(c.cs_stale_lots, c.stale_lots_live, 0)::integer AS stale_lc,
      coalesce(c.cs_stale_bags, c.stale_bags_live, 0)::integer AS stale_bc,
      coalesce(c.lots_active, 0)::integer AS lots_active,
      coalesce(c.lots_stale, 0)::integer AS lots_stale,
      coalesce(c.lots_delivered, 0)::integer AS lots_delivered,
      coalesce(c.bags_asd, 0)::bigint AS bags_asd,
      coalesce(c.lots_asd, 0)::integer AS lots_asd
    FROM combined c
    CROSS JOIN f
    WHERE
      (f.v <> 'outstanding_due' OR coalesce(c.outstanding_total, c.rent_live + c.chg_live) > 0)
      AND (
        f.v <> 'stale_lots'
        OR coalesce(c.cs_stale_lots, c.stale_lots_live, 0) > 0
      )
  ),
  ranked AS (
    SELECT
      t.*,
      row_number() OVER (
        ORDER BY
          t.outst DESC,
          t.lots_asd DESC,
          lower(t.customer_name::text) ASC NULLS LAST,
          t.customer_code::text ASC
      ) AS rn
    FROM filtered t
  )
  SELECT
    r.cid AS customer_id,
    r.customer_code,
    r.customer_name,
    r.address,
    r.outst AS outstanding_total,
    r.rents_eff AS outstanding_rents,
    r.chg_eff AS outstanding_charges,
    r.fresh_lc AS fresh_lot_count,
    r.fresh_bc AS fresh_bag_count,
    r.aging_lc AS aging_lot_count,
    r.aging_bc AS aging_bag_count,
    r.stale_lc AS stale_lot_count,
    r.stale_bc AS stale_bag_count,
    r.lots_active,
    r.lots_stale,
    r.lots_delivered,
    r.bags_asd AS bags_active_stale_delivered
  FROM ranked r
  WHERE r.rn > v_offset
    AND r.rn <= v_offset + v_limit
  ORDER BY r.rn;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.parties_tab_kpis(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_parties_tab(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_parties_tab(uuid, text, text, integer, integer) TO authenticated;