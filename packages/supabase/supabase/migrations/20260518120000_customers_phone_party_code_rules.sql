-- Primary phone vs party code: same code shares one phone; one phone maps to one code per warehouse.
-- Data audit runs before trigger install; fix violations if migration fails.

CREATE OR REPLACE FUNCTION public.normalize_customer_phone(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN NULL
    ELSE (
      WITH d AS (
        SELECT regexp_replace(btrim(p), '\D', '', 'g') AS x
      )
      SELECT CASE
        WHEN length((SELECT x FROM d)) = 12 AND substr((SELECT x FROM d), 1, 2) = '91' THEN substr((SELECT x FROM d), 3)
        WHEN length((SELECT x FROM d)) = 11 AND substr((SELECT x FROM d), 1, 1) = '0' THEN substr((SELECT x FROM d), 2)
        ELSE (SELECT x FROM d)
      END
    )
  END;
$fn$;

DO $$
DECLARE
  v_mixed int;
  v_dup int;
BEGIN
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

DROP TRIGGER IF EXISTS customers_phone_party_code_enforce ON public.customers;

CREATE TRIGGER customers_phone_party_code_enforce
  BEFORE INSERT OR UPDATE OF phone, customer_code, warehouse_id
  ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_enforce_phone_party_code();
