-- Active-only uniqueness (warehouse + party code + party name).
-- Relax phone/party_code trigger: allow first primary phone on a code when peers have no phone yet.
-- Relaxed data audit: only fail on multiple distinct non-null phones per code, or phone shared across codes.

DO $$
DECLARE
  v_active_dups int;
  v_mixed int;
  v_dup int;
BEGIN
  SELECT count(*)::int INTO v_active_dups
  FROM (
    SELECT 1
    FROM public.customers c
    WHERE c.is_active IS TRUE
    GROUP BY c.warehouse_id, c.customer_code, c.customer_name
    HAVING count(*) > 1
  ) x;

  IF v_active_dups > 0 THEN
    RAISE EXCEPTION
      'customers migration blocked: % duplicate active (warehouse_id, customer_code, customer_name) groups — resolve before applying',
      v_active_dups;
  END IF;

  SELECT count(*)::int INTO v_mixed
  FROM (
    SELECT c.warehouse_id, c.customer_code
    FROM public.customers c
    GROUP BY c.warehouse_id, c.customer_code
    HAVING count(DISTINCT public.normalize_customer_phone(c.phone)) FILTER (
             WHERE c.phone IS NOT NULL AND btrim(c.phone) <> ''
           ) > 1
  ) s;

  SELECT count(*)::int INTO v_dup
  FROM (
    SELECT t.warehouse_id, t.norm
    FROM (
      SELECT
        c.warehouse_id,
        public.normalize_customer_phone(c.phone) AS norm,
        c.customer_code
      FROM public.customers c
      WHERE c.phone IS NOT NULL AND btrim(c.phone) <> ''
        AND public.normalize_customer_phone(c.phone) IS NOT NULL
        AND length(public.normalize_customer_phone(c.phone)) = 10
    ) t
    GROUP BY t.warehouse_id, t.norm
    HAVING count(DISTINCT t.customer_code) > 1
  ) d;

  IF v_mixed > 0 OR v_dup > 0 THEN
    RAISE EXCEPTION
      'customers phone/party_code audit failed: % same-code phone conflicts, % phone-to-multiple-code conflicts — fix data then re-run migration',
      v_mixed,
      v_dup;
  END IF;
END $$;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_warehouse_code_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS customers_wh_code_name_active_uidx
  ON public.customers (warehouse_id, customer_code, customer_name)
  WHERE is_active IS TRUE;

CREATE OR REPLACE FUNCTION public.customers_enforce_phone_party_code()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  norm_new text;
  conflict_code text;
  peer_distinct int;
  peer_norm text;
BEGIN
  norm_new := public.normalize_customer_phone(NEW.phone);

  IF norm_new IS NOT NULL AND length(norm_new) = 10 THEN
    SELECT c.customer_code INTO conflict_code
    FROM public.customers c
    WHERE c.warehouse_id = NEW.warehouse_id
      AND c.id IS DISTINCT FROM NEW.id
      AND public.normalize_customer_phone(c.phone) IS NOT DISTINCT FROM norm_new
      AND c.customer_code IS DISTINCT FROM NEW.customer_code
    LIMIT 1;
    IF conflict_code IS NOT NULL THEN
      RAISE EXCEPTION 'Phone number is already set up for %', conflict_code
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT count(DISTINCT public.normalize_customer_phone(c.phone)) INTO peer_distinct
  FROM public.customers c
  WHERE c.warehouse_id = NEW.warehouse_id
    AND c.customer_code = NEW.customer_code
    AND c.id IS DISTINCT FROM NEW.id
    AND c.phone IS NOT NULL AND btrim(c.phone) <> '';

  IF peer_distinct > 1 THEN
    RAISE EXCEPTION 'Party code % has different phone numbers on file.', NEW.customer_code
      USING ERRCODE = '23514';
  END IF;

  IF peer_distinct = 1 THEN
    SELECT public.normalize_customer_phone(c.phone) INTO peer_norm
    FROM public.customers c
    WHERE c.warehouse_id = NEW.warehouse_id
      AND c.customer_code = NEW.customer_code
      AND c.id IS DISTINCT FROM NEW.id
      AND c.phone IS NOT NULL AND btrim(c.phone) <> ''
    LIMIT 1;

    IF norm_new IS NULL OR length(norm_new) <> 10 OR norm_new IS DISTINCT FROM peer_norm THEN
      RAISE EXCEPTION 'This phone does not match the number already used for this party code.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;
