-- Transport charge overlay: load import_staging.raw_lots_charges_paid after
-- import_staging.apply_lots_from_raw has created lots/deliveries and non-transport
-- transaction_charges. Inserts TRANSPORT rows only (idempotent per lot+date or delivery+date).

CREATE TABLE IF NOT EXISTS import_staging.raw_lots_charges_paid (
  id bigserial PRIMARY KEY,
  transaction_date text NOT NULL,
  customer_code text NOT NULL,
  customer_name text NOT NULL,
  product_name text NOT NULL,
  transfer_mode text NOT NULL,
  lot_number text NOT NULL,
  num_bags text,
  external_reference_id text,
  transport_charges_paid text,
  transport_charges_receivable text
);

CREATE INDEX IF NOT EXISTS idx_raw_lots_charges_paid_tx_id
  ON import_staging.raw_lots_charges_paid (id);

COMMENT ON TABLE import_staging.raw_lots_charges_paid IS
  'Optional overlay CSV (transport paid/receivable). \\copy here, then import_staging.apply_transport_charges_from_raw. Run only after apply_lots_from_raw.';

CREATE OR REPLACE FUNCTION import_staging.apply_transport_charges_from_raw(
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
  r import_staging.raw_lots_charges_paid%ROWTYPE;
  v_tx date;
  v_mode text;
  v_lot_num text;
  v_bags integer;
  v_lot_id uuid;
  v_lot_product uuid;
  v_del_id uuid;
  v_ext text;
  v_num_out integer;
  v_paid numeric;
  v_recv numeric;
  v_pctype uuid;
  v_is_paid boolean;
  v_ccode text;
  v_cname text;
  in_ins bigint := 0;
  in_sk bigint := 0;
  out_ins bigint := 0;
  out_sk bigint := 0;
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
    FROM import_staging.raw_lots_charges_paid s
    ORDER BY import_staging.parse_us_date(s.transaction_date) NULLS LAST, s.id
  LOOP
    v_tx := import_staging.parse_us_date(r.transaction_date);
    IF v_tx IS NULL THEN
      RAISE EXCEPTION 'Bad transaction_date on raw_lots_charges_paid id %: %', r.id, r.transaction_date;
    END IF;

    v_mode := upper(btrim(r.transfer_mode));
    v_lot_num := btrim(r.lot_number);
    v_bags := greatest(0, floor(import_staging._trim_num(r.num_bags))::integer);
    v_ccode := btrim(r.customer_code);
    v_cname := btrim(r.customer_name);

    v_paid := import_staging._trim_num(r.transport_charges_paid);
    v_recv := import_staging._trim_num(r.transport_charges_receivable);
    IF v_recv = 0 AND v_paid = 0 THEN
      CONTINUE;
    END IF;

    IF v_mode = 'IN' THEN
      SELECT l.id, l.product_id
        INTO v_lot_id, v_lot_product
      FROM public.lots l
      JOIN public.customers c
        ON c.id = l.customer_id
      WHERE l.warehouse_id = p_warehouse_id
        AND l.lot_number = v_lot_num
        AND c.customer_code = v_ccode
        AND c.customer_name = v_cname
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        RAISE EXCEPTION 'IN transport: lot not found or customer mismatch staging id % lot %', r.id, v_lot_num;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = v_lot_product
          AND p.tenant_id = p_tenant_id
          AND p.product_name = btrim(r.product_name)
      ) THEN
        RAISE EXCEPTION 'IN transport: product_name mismatch staging id %', r.id;
      END IF;

      v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'TRANSPORT');
      IF v_pctype IS NULL THEN
        RAISE EXCEPTION 'IN transport: missing product_charges TRANSPORT for product at staging id %', r.id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.transaction_charges tc
        WHERE tc.lot_id = v_lot_id
          AND tc.delivery_id IS NULL
          AND tc.charge_date = v_tx
          AND tc.product_charge_type_id = v_pctype
      ) THEN
        in_sk := in_sk + 1;
        CONTINUE;
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
      in_ins := in_ins + 1;

    ELSIF v_mode = 'OUT' THEN
      SELECT l.id, l.product_id
        INTO v_lot_id, v_lot_product
      FROM public.lots l
      JOIN public.customers c
        ON c.id = l.customer_id
      WHERE l.warehouse_id = p_warehouse_id
        AND l.lot_number = v_lot_num
        AND c.customer_code = v_ccode
        AND c.customer_name = v_cname
      LIMIT 1;

      IF v_lot_id IS NULL THEN
        RAISE EXCEPTION 'OUT transport: lot not found or customer mismatch staging id %', r.id;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = v_lot_product
          AND p.tenant_id = p_tenant_id
          AND p.product_name = btrim(r.product_name)
      ) THEN
        RAISE EXCEPTION 'OUT transport: product_name mismatch staging id %', r.id;
      END IF;

      v_pctype := import_staging._product_charge_type_id(p_tenant_id, v_lot_product, 'TRANSPORT');
      IF v_pctype IS NULL THEN
        RAISE EXCEPTION 'OUT transport: missing product_charges TRANSPORT for product at staging id %', r.id;
      END IF;

      v_ext := CASE
        WHEN r.external_reference_id IS NOT NULL AND length(btrim(r.external_reference_id)) > 0
          THEN btrim(r.external_reference_id)
        ELSE NULL::text
      END;

      v_num_out := greatest(1, CASE WHEN v_bags > 0 THEN v_bags ELSE 1 END);

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

      IF v_del_id IS NULL THEN
        RAISE EXCEPTION 'OUT transport: delivery not found (run apply_lots_from_raw first) staging id %', r.id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.transaction_charges tc
        WHERE tc.delivery_id = v_del_id
          AND tc.charge_date = v_tx
          AND tc.product_charge_type_id = v_pctype
      ) THEN
        out_sk := out_sk + 1;
        CONTINUE;
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
      out_ins := out_ins + 1;

    ELSE
      RAISE EXCEPTION 'Unknown transfer_mode on raw_lots_charges_paid id %: %', r.id, r.transfer_mode;
    END IF;
  END LOOP;

  IF p_truncate_staging THEN
    TRUNCATE import_staging.raw_lots_charges_paid;
  END IF;

  RETURN jsonb_build_object(
    'transport_in_inserted', in_ins,
    'transport_in_skipped_duplicate', in_sk,
    'transport_out_inserted', out_ins,
    'transport_out_skipped_duplicate', out_sk
  );
END;
$$;

REVOKE ALL ON FUNCTION import_staging.apply_transport_charges_from_raw(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION import_staging.apply_transport_charges_from_raw(uuid, uuid, boolean) TO service_role;

COMMENT ON FUNCTION import_staging.apply_transport_charges_from_raw(uuid, uuid, boolean) IS
  'Insert TRANSPORT transaction_charges from import_staging.raw_lots_charges_paid. Requires existing lots/deliveries from apply_lots_from_raw. Idempotent per (lot|delivery)+charge_date+TRANSPORT product_charge_type.';
