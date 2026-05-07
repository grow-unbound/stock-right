-- Yearly rent cutoff as recurring month/day; idempotent rent accruals; in-DB backfill.
-- Import staging (rental_mode_from_date warehouse cutoff) follows in 20260502120000_import_staging_rental_mode_warehouse.sql.

-- ---------------------------------------------------------------------------
-- 1. warehouse_settings: recurring cutoff (no year)
-- ---------------------------------------------------------------------------
ALTER TABLE public.warehouse_settings
  ADD COLUMN yearly_rent_cutoff_month smallint NOT NULL DEFAULT 1,
  ADD COLUMN yearly_rent_cutoff_day smallint NOT NULL DEFAULT 1;

UPDATE public.warehouse_settings
SET
  yearly_rent_cutoff_month = EXTRACT(MONTH FROM yearly_rent_cutoff_date)::smallint,
  yearly_rent_cutoff_day = EXTRACT(DAY FROM yearly_rent_cutoff_date)::smallint;

ALTER TABLE public.warehouse_settings
  DROP COLUMN yearly_rent_cutoff_date;

ALTER TABLE public.warehouse_settings
  ADD CONSTRAINT warehouse_settings_yearly_cutoff_month_check CHECK (
    yearly_rent_cutoff_month BETWEEN 1 AND 12
  ),
  ADD CONSTRAINT warehouse_settings_yearly_cutoff_day_check CHECK (
    yearly_rent_cutoff_day BETWEEN 1 AND 31
  );

-- ---------------------------------------------------------------------------
-- 2. Idempotent accrual periods
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX rent_accruals_lot_accrual_period_uniq
  ON public.rent_accruals (lot_id, accrual_from, accrual_to);

-- ---------------------------------------------------------------------------
-- 3. Cutoff helper (calendar-safe for month/day across years)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rent_yearly_cutoff_in_year(
  p_year integer,
  p_cut_month smallint,
  p_cut_day smallint
)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT make_date(
    p_year,
    p_cut_month::integer,
    LEAST(
      p_cut_day::integer,
      EXTRACT(day FROM (
        date_trunc('month', make_date(p_year, p_cut_month::integer, 1))
        + interval '1 month - 1 day'
      ))::integer
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Per-warehouse month generator (internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._generate_rent_accruals_for_month_warehouse(
  p_warehouse_id uuid,
  p_month date,
  p_narrow_lot_scope boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_m_start date;
  v_m_end date;
  v_year integer;
  v_mon integer;
  v_inserted integer := 0;
  v_skip_rate integer := 0;
  v_skip_stock integer := 0;
  rec record;
  v_lod_year integer;
  v_lod_mon integer;
  v_cutoff date;
  v_initial_yearly boolean;
  v_out_before integer;
  v_max_bags integer;
  v_open_jan integer;
  v_amt numeric;
  v_ins integer;
  v_total_out_before_jan integer;
BEGIN
  v_m_start := date_trunc('month', p_month)::date;
  v_m_end := (v_m_start + interval '1 month - 1 day')::date;
  v_year := EXTRACT(year FROM v_m_end)::integer;
  v_mon := EXTRACT(month FROM v_m_end)::integer;

  FOR rec IN
    SELECT
      l.id AS lot_id,
      l.original_bags,
      l.lodgement_date,
      l.status,
      ws.grace_period_months,
      ws.yearly_rent_cutoff_month,
      ws.yearly_rent_cutoff_day,
      p.monthly_rent_per_bag,
      p.yearly_rent_per_bag
    FROM public.lots l
    INNER JOIN public.warehouse_settings ws ON ws.warehouse_id = l.warehouse_id
    INNER JOIN public.products p ON p.id = l.product_id
    WHERE l.warehouse_id = p_warehouse_id
      AND l.status NOT IN ('WRITTEN_OFF'::public.lot_status, 'DISPUTED'::public.lot_status)
      AND (
        NOT p_narrow_lot_scope
        OR l.status IN ('ACTIVE'::public.lot_status, 'STALE'::public.lot_status)
        OR (
          l.status IN ('DELIVERED'::public.lot_status, 'CLEARED'::public.lot_status)
          AND l.updated_at >= (v_m_start - interval '1 month')
        )
      )
  LOOP
    IF v_m_end < rec.lodgement_date THEN
      CONTINUE;
    END IF;

    SELECT
      COALESCE(SUM(d.num_bags_out) FILTER (
        WHERE d.delivery_date < v_m_start
      ), 0)::integer
    INTO v_out_before
    FROM public.deliveries d
    WHERE d.lot_id = rec.lot_id
      AND d.status = 'DELIVERED'::public.delivery_status;

    v_max_bags := rec.original_bags - v_out_before;

    IF v_max_bags <= 0 THEN
      v_skip_stock := v_skip_stock + 1;
      CONTINUE;
    END IF;

    v_lod_year := EXTRACT(year FROM rec.lodgement_date)::integer;
    v_lod_mon := EXTRACT(month FROM rec.lodgement_date)::integer;

    IF v_lod_year = v_year THEN
      v_cutoff := public.rent_yearly_cutoff_in_year(
        v_lod_year,
        rec.yearly_rent_cutoff_month,
        rec.yearly_rent_cutoff_day
      );
      v_initial_yearly := rec.lodgement_date <= v_cutoff;

      IF v_initial_yearly THEN
        IF rec.yearly_rent_per_bag IS NULL THEN
          v_skip_rate := v_skip_rate + 1;
          CONTINUE;
        END IF;
        IF v_mon = v_lod_mon THEN
          v_amt := round(rec.original_bags::numeric * rec.yearly_rent_per_bag, 2);
          INSERT INTO public.rent_accruals (
            lot_id,
            accrual_date,
            accrual_from,
            accrual_to,
            rental_amount,
            rental_mode,
            notes
          )
          VALUES (
            rec.lot_id,
            v_m_end,
            v_m_start,
            v_m_end,
            v_amt,
            'YEARLY'::public.rental_mode,
            'rent accrual (initial yearly)'
          )
          ON CONFLICT (lot_id, accrual_from, accrual_to) DO NOTHING;
          GET DIAGNOSTICS v_ins = ROW_COUNT;
          v_inserted := v_inserted + v_ins;
        END IF;
      ELSE
        IF rec.monthly_rent_per_bag IS NULL THEN
          v_skip_rate := v_skip_rate + 1;
          CONTINUE;
        END IF;
        IF v_mon >= v_lod_mon THEN
          v_amt := round(v_max_bags::numeric * rec.monthly_rent_per_bag, 2);
          INSERT INTO public.rent_accruals (
            lot_id,
            accrual_date,
            accrual_from,
            accrual_to,
            rental_amount,
            rental_mode,
            notes
          )
          VALUES (
            rec.lot_id,
            v_m_end,
            v_m_start,
            v_m_end,
            v_amt,
            'MONTHLY'::public.rental_mode,
            'rent accrual (initial monthly)'
          )
          ON CONFLICT (lot_id, accrual_from, accrual_to) DO NOTHING;
          GET DIAGNOSTICS v_ins = ROW_COUNT;
          v_inserted := v_inserted + v_ins;
        END IF;
      END IF;
    ELSIF v_lod_year < v_year THEN
      SELECT COALESCE(SUM(d.num_bags_out), 0)::integer
      INTO v_total_out_before_jan
      FROM public.deliveries d
      WHERE d.lot_id = rec.lot_id
        AND d.status = 'DELIVERED'::public.delivery_status
        AND d.delivery_date < make_date(v_year, 1, 1);

      v_open_jan := rec.original_bags - v_total_out_before_jan;

      IF v_open_jan <= 0 THEN
        v_skip_stock := v_skip_stock + 1;
        CONTINUE;
      END IF;

      IF v_mon = 1 THEN
        UPDATE public.lots l
        SET
          rental_mode = 'BROUGHT_FORWARD'::public.rental_mode,
          updated_at = now()
        WHERE l.id = rec.lot_id
          AND l.rental_mode IS DISTINCT FROM 'BROUGHT_FORWARD'::public.rental_mode;
      END IF;

      IF v_mon <= rec.grace_period_months THEN
        IF rec.monthly_rent_per_bag IS NULL THEN
          v_skip_rate := v_skip_rate + 1;
          CONTINUE;
        END IF;
        v_amt := round(v_max_bags::numeric * rec.monthly_rent_per_bag, 2);
        INSERT INTO public.rent_accruals (
          lot_id,
          accrual_date,
          accrual_from,
          accrual_to,
          rental_amount,
          rental_mode,
          notes
        )
        VALUES (
          rec.lot_id,
          v_m_end,
          v_m_start,
          v_m_end,
          v_amt,
          'BROUGHT_FORWARD'::public.rental_mode,
          'rent accrual (BF monthly)'
        )
        ON CONFLICT (lot_id, accrual_from, accrual_to) DO NOTHING;
        GET DIAGNOSTICS v_ins = ROW_COUNT;
        v_inserted := v_inserted + v_ins;
      ELSIF rec.grace_period_months < 12
              AND v_mon = rec.grace_period_months + 1 THEN
        IF v_max_bags <= 0 THEN
          CONTINUE;
        END IF;
        IF rec.yearly_rent_per_bag IS NULL THEN
          v_skip_rate := v_skip_rate + 1;
          CONTINUE;
        END IF;
        v_amt := round(v_max_bags::numeric * rec.yearly_rent_per_bag, 2);
        INSERT INTO public.rent_accruals (
          lot_id,
          accrual_date,
          accrual_from,
          accrual_to,
          rental_amount,
          rental_mode,
          notes
        )
        VALUES (
          rec.lot_id,
          v_m_end,
          v_m_start,
          v_m_end,
          v_amt,
          'YEARLY'::public.rental_mode,
          'rent accrual (BF yearly post-grace)'
        )
        ON CONFLICT (lot_id, accrual_from, accrual_to) DO NOTHING;
        GET DIAGNOSTICS v_ins = ROW_COUNT;
        v_inserted := v_inserted + v_ins;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'warehouse_id', p_warehouse_id,
    'month_start', v_m_start,
    'month_end', v_m_end,
    'rows_inserted', v_inserted,
    'skipped_no_rate', v_skip_rate,
    'skipped_no_stock_approx', v_skip_stock
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Public API: one warehouse or all warehouses
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_rent_accruals_for_month(
  p_warehouse_id uuid,
  p_month date,
  p_narrow_lot_scope boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  wh record;
  parts jsonb := '[]'::jsonb;
  one jsonb;
BEGIN
  IF p_warehouse_id IS NULL THEN
    FOR wh IN SELECT w.id AS wid FROM public.warehouses w ORDER BY w.id
    LOOP
      one := public._generate_rent_accruals_for_month_warehouse(
        wh.wid,
        p_month,
        p_narrow_lot_scope
      );
      parts := parts || jsonb_build_array(one);
    END LOOP;
    RETURN jsonb_build_object(
      'all_warehouses', true,
      'month', date_trunc('month', p_month)::date,
      'by_warehouse', parts
    );
  END IF;

  RETURN public._generate_rent_accruals_for_month_warehouse(
    p_warehouse_id,
    p_month,
    p_narrow_lot_scope
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. One-time backfill (Postgres-only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_rent_accruals(
  p_warehouse_id uuid DEFAULT NULL,
  p_from_month date DEFAULT '2023-01-01'::date,
  p_through_month date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from date := date_trunc('month', p_from_month)::date;
  v_thru date := COALESCE(
    p_through_month,
    (date_trunc('month', CURRENT_DATE) - interval '1 day')::date
  );
  v_thru_m date := date_trunc('month', v_thru)::date;
  m date;
  bucket jsonb := '[]'::jsonb;
  j jsonb;
BEGIN
  IF v_from > v_thru_m THEN
    RETURN jsonb_build_object('error', 'from_month after through_month');
  END IF;

  m := v_from;
  WHILE m <= v_thru_m LOOP
    IF p_warehouse_id IS NULL THEN
      j := public.generate_rent_accruals_for_month(NULL::uuid, m, false);
    ELSE
      j := public.generate_rent_accruals_for_month(p_warehouse_id, m, false);
    END IF;
    bucket := bucket || jsonb_build_array(jsonb_build_object('accrual_month', m, 'result', j));
    m := (m + interval '1 month')::date;
  END LOOP;

  RETURN jsonb_build_object(
    'from', v_from,
    'through', v_thru_m,
    'per_month', bucket
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rent_yearly_cutoff_in_year(integer, smallint, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._generate_rent_accruals_for_month_warehouse(uuid, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_rent_accruals_for_month(uuid, date, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_rent_accruals(uuid, date, date) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.rent_yearly_cutoff_in_year(integer, smallint, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION public._generate_rent_accruals_for_month_warehouse(uuid, date, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_rent_accruals_for_month(uuid, date, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_rent_accruals(uuid, date, date) TO service_role;

COMMENT ON FUNCTION public.generate_rent_accruals_for_month(uuid, date, boolean) IS
  'Idempotent monthend rent accruals per §1.5; pass NULL warehouse for all. p_narrow_lot_scope default true (monthly job, fewer lots); use false for backfill. Safe to re-run.';
COMMENT ON FUNCTION public.backfill_rent_accruals(uuid, date, date) IS
  'Loop months in-DB from p_from_month through p_through_month (default: end of previous calendar month).';
