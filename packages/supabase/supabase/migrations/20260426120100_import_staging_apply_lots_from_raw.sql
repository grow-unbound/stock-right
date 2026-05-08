-- Apply import_staging.raw_lots_and_deliveries into public.lots / deliveries / transaction_charges.
-- Mirrors semantics of scripts/import-sri-sai-padala.mjs lots loop (IN/OUT, charge lines, idempotency).
-- Run after COPY into raw_lots_and_deliveries:
--   SELECT import_staging.apply_lots_from_raw('<tenant_uuid>', '<warehouse_uuid>', true);

SET search_path = public;

CREATE OR REPLACE FUNCTION import_staging._trim_num(p text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN 0::numeric
    ELSE replace(btrim(p), ',', '')::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION import_staging.parse_us_date(p text)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parts text[];
BEGIN
  IF p IS NULL OR length(btrim(p)) = 0 THEN
    RETURN NULL;
  END IF;
  parts := string_to_array(btrim(p), '/');
  IF array_upper(parts, 1) IS DISTINCT FROM 3 THEN
    RETURN NULL;
  END IF;
  RETURN make_date(parts[3]::int, parts[1]::int, parts[2]::int);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION import_staging.rental_mode_from_date(d date)
RETURNS public.rental_mode
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN d IS NULL THEN 'MONTHLY'::public.rental_mode
    WHEN EXTRACT(MONTH FROM d)::int < 5
      OR (EXTRACT(MONTH FROM d)::int = 5 AND EXTRACT(DAY FROM d)::int <= 31) THEN 'YEARLY'::public.rental_mode
    ELSE 'MONTHLY'::public.rental_mode
  END;
$$;

CREATE OR REPLACE FUNCTION import_staging._location_ids(p_warehouse_id uuid, p_legacy text)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  ids uuid[] := ARRAY[]::uuid[];
  nm text;
  lid uuid;
BEGIN
  IF p_legacy IS NULL OR btrim(p_legacy) = '' OR btrim(p_legacy) = '0' THEN
    RETURN ids;
  END IF;
  FOR nm IN SELECT btrim(x)
            FROM unnest(string_to_array(p_legacy, ',')) AS t(x)
  LOOP
    IF nm = '' OR nm = '0' THEN
      CONTINUE;
    END IF;
    SELECT l.id
      INTO lid
    FROM public.locations l
    WHERE l.warehouse_id = p_warehouse_id
      AND l.name = nm
    LIMIT 1;
    IF lid IS NOT NULL THEN
      ids := array_append(ids, lid);
    END IF;
  END LOOP;
  RETURN ids;
END;
$$;

CREATE OR REPLACE FUNCTION import_staging._product_charge_type_id(
  p_tenant_id uuid,
  p_product_id uuid,
  p_code text
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT pc.product_charge_type_id
  FROM public.product_charges pc
  JOIN public.charge_types ct
    ON ct.id = pc.charge_type_id
   AND ct.tenant_id = p_tenant_id
  WHERE pc.product_id = p_product_id
    AND ct.code = p_code
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION import_staging.apply_lots_from_raw(
  p_tenant_id uuid,
  p_warehouse_id uuid,
  p_truncate_staging boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, import_staging
AS $$
DECLARE
  v_wh_tenant uuid;
  r import_staging.raw_lots_and_deliveries%ROWTYPE;
  v_tx date;
  v_mode text;
  v_cust uuid;
  v_prod uuid;
  v_lot_num text;
  v_bags integer;
  v_lot_id uuid;
  v_lot_existed boolean;
  v_lot_product uuid;
  v_ext text;
  v_num_out integer;
  v_del_id uuid;
  v_del_new boolean;
  v_bal integer;
  v_paid numeric;
  v_recv numeric;
  v_pctype uuid;
  v_is_paid boolean;
  v_loc_lot uuid[];
  v_loc_del uuid[];
  v_lot_ext text;
  v_any_charges boolean;
  in_ins bigint := 0;
  in_reu bigint := 0;
  in_ch_ins bigint := 0;
  in_ch_sk bigint := 0;
  out_d_ins bigint := 0;
  out_d_reu bigint := 0;
  out_ch_ins bigint := 0;
  out_ch_sk bigint := 0;
BEGIN
  SELECT w.tenant_id
    INTO v_wh_tenant
  FROM public.warehouses w
  WHERE w.id = p_warehouse_id;

  IF v_wh_tenant IS NULL THEN
    RAISE EXCEPTION 'Warehouse not found: %', p_warehouse_id;
  END IF;
  IF v_wh_tenant IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'Warehouse % does not belong to tenant %', p_warehouse_id, p_tenant_id;
  END IF;

  FOR r IN
    SELECT s.*
    FROM import_staging.raw_lots_and_deliveries s
    ORDER BY import_staging.parse_us_date(s.transaction_date) NULLS LAST, s.id
  LOOP
    v_lot_id := NULL;
    v_del_id := NULL;
    v_lot_product := NULL;
    v_any_charges := false;

    v_tx := import_staging.parse_us_date(r.transaction_date);
    IF v_tx IS NULL THEN
      RAISE EXCEPTION 'Bad transaction_date on staging id %: %', r.id, r.transaction_date;
    END IF;

    v_mode := upper(btrim(r.transfer_mode));
    v_lot_num := btrim(r.lot_number);

    SELECT c.id
      INTO v_cust
    FROM public.customers c
    WHERE c.warehouse_id = p_warehouse_id
      AND c.customer_code = btrim(r.customer_code)
      AND c.customer_name = btrim(r.customer_name)
    LIMIT 1;
    IF v_cust IS NULL THEN
      RAISE EXCEPTION 'Unknown customer staging id %: % / %', r.id, r.customer_code, r.customer_name;
    END IF;

    SELECT p.id
      INTO v_prod
    FROM public.products p
    WHERE p.tenant_id = p_tenant_id
      AND p.product_name = btrim(r.product_name)
    LIMIT 1;
    IF v_prod IS NULL THEN
      RAISE EXCEPTION 'Unknown product staging id %: %', r.id, r.product_name;
    END IF;

    v_bags := greatest(0, floor(import_staging._trim_num(r.num_bags))::integer);

    IF v_mode = 'IN' THEN
      v_loc_lot := import_staging._location_ids(p_warehouse_id, r.lots_legacy_locations);
      v_lot_ext := CASE
        WHEN r.external_reference_id IS NOT NULL AND length(btrim(r.external_reference_id)) > 0
          THEN btrim(r.external_reference_id)
        ELSE NULL::text
      END;

      SELECT l.id
        INTO v_lot_id
      FROM public.lots l
      WHERE l.warehouse_id = p_warehouse_id
        AND l.lot_number = v_lot_num
      LIMIT 1;

      v_lot_existed := FOUND;

      IF v_lot_id IS NULL THEN
        INSERT INTO public.lots (
          warehouse_id,
          tenant_id,
          customer_id,
          product_id,
          lot_number,
          original_bags,
          balance_bags,
          lodgement_date,
          rental_mode,
          location_ids,
          legacy_locations,
          driver_name,
          vehicle_number,
          notes,
          external_reference_id,
          status
        )
        VALUES (
          p_warehouse_id,
          p_tenant_id,
          v_cust,
          v_prod,
          v_lot_num,
          v_bags,
          v_bags,
          v_tx,
          import_staging.rental_mode_from_date(v_tx),
          v_loc_lot,
          CASE
            WHEN r.lots_legacy_locations IS NOT NULL
              AND btrim(r.lots_legacy_locations) <> ''
              AND btrim(r.lots_legacy_locations) <> '0' THEN r.lots_legacy_locations
            ELSE NULL
          END,
          nullif(btrim(r.driver_name), ''),
          nullif(btrim(r.vehicle_number), ''),
          nullif(btrim(r.notes), ''),
          v_lot_ext,
          'ACTIVE'::public.lot_status
        )
        RETURNING id INTO v_lot_id;
        in_ins := in_ins + 1;
      ELSE
        in_reu := in_reu + 1;
      END IF;

      IF v_lot_existed AND EXISTS (
        SELECT 1
        FROM public.transaction_charges tc
        WHERE tc.lot_id = v_lot_id
          AND tc.delivery_id IS NULL
          AND tc.charge_date = v_tx
      ) THEN
        in_ch_sk := in_ch_sk + 1;
        CONTINUE;
      END IF;

      v_any_charges := false;

      -- HAMALI
      v_paid := import_staging._trim_num(r.hamali_charges_paid);
      v_recv := import_staging._trim_num(r.hamali_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_prod, 'HAMALI');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge HAMALI for product % staging id %', r.product_name, r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          NULL,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      -- KATA_COOLIE
      v_paid := import_staging._trim_num(r.kata_coolie_charges_paid);
      v_recv := import_staging._trim_num(r.kata_coolie_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_prod, 'KATA_COOLIE');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge KATA_COOLIE for product % staging id %', r.product_name, r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          NULL,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      -- MAMULLE
      v_paid := import_staging._trim_num(r.mamullu_charges_paid);
      v_recv := import_staging._trim_num(r.mamullu_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_prod, 'MAMULLE');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge MAMULLE for product % staging id %', r.product_name, r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          NULL,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      -- PLATFORM_HAMALI
      v_paid := import_staging._trim_num(r.platform_hamali_charges_paid);
      v_recv := import_staging._trim_num(r.platform_hamali_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_prod, 'PLATFORM_HAMALI');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge PLATFORM_HAMALI for product % staging id %', r.product_name, r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          NULL,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      IF v_any_charges THEN
        in_ch_ins := in_ch_ins + 1;
      END IF;

    ELSIF v_mode = 'OUT' THEN
      SELECT l.id, l.product_id
        INTO v_lot_id, v_lot_product
      FROM public.lots l
      WHERE l.warehouse_id = p_warehouse_id
        AND l.lot_number = v_lot_num
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        RAISE EXCEPTION 'OUT: lot not found % staging id %', v_lot_num, r.id;
      END IF;

      v_loc_del := import_staging._location_ids(p_warehouse_id, r.deliveries_legacy_locations);

      v_ext := CASE
        WHEN r.external_reference_id IS NOT NULL AND length(btrim(r.external_reference_id)) > 0
          THEN btrim(r.external_reference_id)
        ELSE NULL::text
      END;

      v_num_out := greatest(1, CASE WHEN v_bags > 0 THEN v_bags ELSE 1 END);

      v_del_new := false;
      IF v_ext IS NOT NULL THEN
        SELECT d.id
          INTO v_del_id
        FROM public.deliveries d
        WHERE d.lot_id = v_lot_id
          AND d.external_reference_id = v_ext
        LIMIT 1;
      ELSE
        SELECT d.id
          INTO v_del_id
        FROM public.deliveries d
        WHERE d.lot_id = v_lot_id
          AND d.delivery_date = v_tx
          AND d.num_bags_out = v_num_out
        LIMIT 1;
      END IF;

      IF v_del_id IS NOT NULL THEN
        out_d_reu := out_d_reu + 1;
      ELSE
        INSERT INTO public.deliveries (
          lot_id,
          num_bags_out,
          delivery_date,
          status,
          driver_name,
          vehicle_number,
          notes,
          legacy_locations,
          location_ids,
          external_reference_id
        )
        VALUES (
          v_lot_id,
          v_num_out,
          v_tx,
          'DELIVERED'::public.delivery_status,
          nullif(btrim(r.driver_name), ''),
          nullif(btrim(r.vehicle_number), ''),
          nullif(btrim(r.notes), ''),
          CASE
            WHEN r.deliveries_legacy_locations IS NOT NULL
              AND btrim(r.deliveries_legacy_locations) <> ''
              AND btrim(r.deliveries_legacy_locations) <> '0' THEN r.deliveries_legacy_locations
            ELSE NULL
          END,
          v_loc_del,
          v_ext
        )
        RETURNING id INTO v_del_id;
        v_del_new := true;
        out_d_ins := out_d_ins + 1;

        SELECT l.balance_bags
          INTO v_bal
        FROM public.lots l
        WHERE l.id = v_lot_id;

        UPDATE public.lots l
        SET balance_bags = greatest(0, coalesce(v_bal, 0) - v_num_out)
        WHERE l.id = v_lot_id;
      END IF;

      IF NOT v_del_new AND EXISTS (
        SELECT 1
        FROM public.transaction_charges tc
        WHERE tc.delivery_id = v_del_id
      ) THEN
        out_ch_sk := out_ch_sk + 1;
        CONTINUE;
      END IF;

      v_any_charges := false;

      -- charges on OUT use lot's product_id
      v_paid := import_staging._trim_num(r.hamali_charges_paid);
      v_recv := import_staging._trim_num(r.hamali_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'HAMALI');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge HAMALI for lot product staging id %', r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          v_del_id,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      v_paid := import_staging._trim_num(r.kata_coolie_charges_paid);
      v_recv := import_staging._trim_num(r.kata_coolie_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'KATA_COOLIE');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge KATA_COOLIE for lot product staging id %', r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          v_del_id,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      v_paid := import_staging._trim_num(r.mamullu_charges_paid);
      v_recv := import_staging._trim_num(r.mamullu_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'MAMULLE');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge MAMULLE for lot product staging id %', r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          v_del_id,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      v_paid := import_staging._trim_num(r.platform_hamali_charges_paid);
      v_recv := import_staging._trim_num(r.platform_hamali_charges_receivable);
      IF v_recv <> 0 OR v_paid <> 0 THEN
        v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'PLATFORM_HAMALI');
        IF v_pctype IS NULL THEN
          RAISE EXCEPTION 'Missing product_charge PLATFORM_HAMALI for lot product staging id %', r.id;
        END IF;
        v_is_paid := v_recv > 0 AND abs(v_recv - v_paid) < 0.01;
        INSERT INTO public.transaction_charges (
          lot_id,
          delivery_id,
          product_charge_type_id,
          charge_amount,
          legacy_amount_paid,
          num_bags,
          charge_date,
          is_paid,
          paid_date
        )
        VALUES (
          v_lot_id,
          v_del_id,
          v_pctype,
          v_recv,
          v_paid,
          v_bags,
          v_tx,
          v_is_paid,
          CASE WHEN v_is_paid THEN v_tx ELSE NULL END
        );
        v_any_charges := true;
      END IF;

      IF v_any_charges THEN
        out_ch_ins := out_ch_ins + 1;
      END IF;

    ELSE
      RAISE EXCEPTION 'Unknown transfer_mode staging id %: %', r.id, r.transfer_mode;
    END IF;
  END LOOP;

  IF p_truncate_staging THEN
    TRUNCATE import_staging.raw_lots_and_deliveries;
  END IF;

  RETURN jsonb_build_object(
    'in_lots_inserted', in_ins,
    'in_lots_reused', in_reu,
    'in_charge_batches_inserted', in_ch_ins,
    'in_charge_batches_skipped', in_ch_sk,
    'out_deliveries_inserted', out_d_ins,
    'out_deliveries_reused', out_d_reu,
    'out_charge_batches_inserted', out_ch_ins,
    'out_charge_batches_skipped', out_ch_sk
  );
END;
$$;

REVOKE ALL ON FUNCTION import_staging._trim_num(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION import_staging.parse_us_date(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION import_staging.rental_mode_from_date(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION import_staging._location_ids(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION import_staging._product_charge_type_id(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION import_staging.apply_lots_from_raw(uuid, uuid, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION import_staging.apply_lots_from_raw(uuid, uuid, boolean) TO service_role;

COMMENT ON FUNCTION import_staging.apply_lots_from_raw(uuid, uuid, boolean) IS
  'Apply raw CSV rows from import_staging.raw_lots_and_deliveries (ordered by transaction_date). Pass p_truncate_staging true to TRUNCATE staging after success.';
