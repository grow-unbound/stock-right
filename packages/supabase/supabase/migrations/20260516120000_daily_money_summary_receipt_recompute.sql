-- Receipt rollup previously incremented daily_money_summary incrementally; any duplicate trigger fire,
-- retry, or bad UPDATE branch caused 2× totals. Recompute each affected day's receipt columns from
-- customer_receipts so the summary always matches reality. Payment columns are left untouched on conflict.

CREATE OR REPLACE FUNCTION public.fn_recompute_daily_money_receipts_for_day(
  p_warehouse_id uuid,
  p_summary_date date
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_tenant uuid;
  v_rec_amt numeric(12, 2);
  v_rec_cnt integer;
  v_party_cnt integer;
  v_pay_amt numeric(12, 2);
  v_pay_cnt integer;
BEGIN
  SELECT w.tenant_id INTO v_tenant
  FROM public.warehouses w
  WHERE w.id = p_warehouse_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(cr.total_amount), 0)::numeric(12, 2),
    COUNT(*)::int,
    COUNT(*)::int
  INTO v_rec_amt, v_rec_cnt, v_party_cnt
  FROM public.customer_receipts cr
  WHERE cr.warehouse_id = p_warehouse_id
    AND cr.receipt_date = p_summary_date;

  SELECT dms.payments_amount, dms.payments_count
  INTO v_pay_amt, v_pay_cnt
  FROM public.daily_money_summary dms
  WHERE dms.warehouse_id = p_warehouse_id
    AND dms.summary_date = p_summary_date;

  v_pay_amt := COALESCE(v_pay_amt, 0)::numeric(12, 2);
  v_pay_cnt := COALESCE(v_pay_cnt, 0);

  IF v_rec_cnt = 0 AND v_pay_amt = 0 AND v_pay_cnt = 0 THEN
    DELETE FROM public.daily_money_summary dms
    WHERE dms.warehouse_id = p_warehouse_id
      AND dms.summary_date = p_summary_date;
    RETURN;
  END IF;

  INSERT INTO public.daily_money_summary (
    warehouse_id,
    tenant_id,
    summary_date,
    receipts_amount,
    receipts_count,
    receipt_parties,
    payments_amount,
    payments_count,
    last_updated_at
  )
  VALUES (
    p_warehouse_id,
    v_tenant,
    p_summary_date,
    v_rec_amt,
    v_rec_cnt,
    v_party_cnt,
    v_pay_amt,
    v_pay_cnt,
    now()
  )
  ON CONFLICT (warehouse_id, summary_date)
  DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    receipts_amount = EXCLUDED.receipts_amount,
    receipts_count = EXCLUDED.receipts_count,
    receipt_parties = EXCLUDED.receipt_parties,
    last_updated_at = now();
END;
$function$;

COMMENT ON FUNCTION public.fn_recompute_daily_money_receipts_for_day(uuid, date) IS
  'Replaces receipt-side aggregates for one warehouse/day from customer_receipts; preserves payments_amount/payments_count.';

CREATE OR REPLACE FUNCTION public.fn_sync_customer_receipt_to_daily_money_summaries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_recompute_daily_money_receipts_for_day(NEW.warehouse_id, NEW.receipt_date);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.warehouse_id IS DISTINCT FROM NEW.warehouse_id
       OR OLD.receipt_date IS DISTINCT FROM NEW.receipt_date
       OR OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      IF OLD.warehouse_id IS DISTINCT FROM NEW.warehouse_id
         OR OLD.receipt_date IS DISTINCT FROM NEW.receipt_date THEN
        PERFORM public.fn_recompute_daily_money_receipts_for_day(OLD.warehouse_id, OLD.receipt_date);
        PERFORM public.fn_recompute_daily_money_receipts_for_day(NEW.warehouse_id, NEW.receipt_date);
      ELSE
        PERFORM public.fn_recompute_daily_money_receipts_for_day(NEW.warehouse_id, NEW.receipt_date);
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_recompute_daily_money_receipts_for_day(OLD.warehouse_id, OLD.receipt_date);
    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_customer_receipt_daily_money ON public.customer_receipts;

CREATE TRIGGER trg_customer_receipt_daily_money
  AFTER INSERT OR UPDATE OR DELETE ON public.customer_receipts
  FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_customer_receipt_to_daily_money_summaries();

-- Repair existing rows: one scan per distinct (warehouse, receipt day).
DO $repair$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT cr.warehouse_id, cr.receipt_date AS summary_date
    FROM public.customer_receipts cr
  LOOP
    PERFORM public.fn_recompute_daily_money_receipts_for_day(r.warehouse_id, r.summary_date);
  END LOOP;
END
$repair$;
