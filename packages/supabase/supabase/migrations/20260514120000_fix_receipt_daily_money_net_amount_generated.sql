-- Receipt sync trigger inserted into daily_money_summary.net_amount; that column is (or must be)
-- GENERATED from receipts_amount − payments_amount. Postgres rejects non-DEFAULT writes (428C9).

CREATE OR REPLACE FUNCTION public.fn_sync_customer_receipt_to_daily_money_summaries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $function$
DECLARE
  v_wh uuid;
  v_tenant uuid;
  v_day date;
  v_amt numeric(12, 2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_wh := NEW.warehouse_id;
    v_tenant := NEW.tenant_id;
    v_day := NEW.receipt_date;
    v_amt := NEW.total_amount;

    INSERT INTO public.daily_money_summary (
      warehouse_id,
      tenant_id,
      summary_date,
      receipts_amount,
      receipts_count,
      receipt_parties,
      last_updated_at
    )
    VALUES (
      v_wh,
      v_tenant,
      v_day,
      v_amt,
      1,
      1,
      now()
    )
    ON CONFLICT (warehouse_id, summary_date)
    DO UPDATE SET
      receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
      receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
      receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
      last_updated_at = now();

    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.receipt_date IS DISTINCT FROM NEW.receipt_date OR OLD.total_amount IS DISTINCT FROM NEW.total_amount THEN
      INSERT INTO public.daily_money_summary (
        warehouse_id,
        tenant_id,
        summary_date,
        receipts_amount,
        receipts_count,
        receipt_parties,
        last_updated_at
      )
      VALUES (
        OLD.warehouse_id,
        OLD.tenant_id,
        OLD.receipt_date,
        -OLD.total_amount,
        -1,
        -1,
        now()
      )
      ON CONFLICT (warehouse_id, summary_date)
      DO UPDATE SET
        receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
        receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
        receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
        last_updated_at = now();

      INSERT INTO public.daily_money_summary (
        warehouse_id,
        tenant_id,
        summary_date,
        receipts_amount,
        receipts_count,
        receipt_parties,
        last_updated_at
      )
      VALUES (
        NEW.warehouse_id,
        NEW.tenant_id,
        NEW.receipt_date,
        NEW.total_amount,
        1,
        1,
        now()
      )
      ON CONFLICT (warehouse_id, summary_date)
      DO UPDATE SET
        receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
        receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
        receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
        last_updated_at = now();

    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.daily_money_summary (
      warehouse_id,
      tenant_id,
      summary_date,
      receipts_amount,
      receipts_count,
      receipt_parties,
      last_updated_at
    )
    VALUES (
      OLD.warehouse_id,
      OLD.tenant_id,
      OLD.receipt_date,
      -OLD.total_amount,
      -1,
      -1,
      now()
    )
    ON CONFLICT (warehouse_id, summary_date)
    DO UPDATE SET
      receipts_amount = public.daily_money_summary.receipts_amount + EXCLUDED.receipts_amount,
      receipts_count = public.daily_money_summary.receipts_count + EXCLUDED.receipts_count,
      receipt_parties = public.daily_money_summary.receipt_parties + EXCLUDED.receipt_parties,
      last_updated_at = now();

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Align schema: net_amount reflects daily receipts minus operational payments for that warehouse/date.
ALTER TABLE public.daily_money_summary DROP COLUMN IF EXISTS net_amount;

ALTER TABLE public.daily_money_summary
  ADD COLUMN net_amount numeric
  GENERATED ALWAYS AS (
    COALESCE(receipts_amount, 0) - COALESCE(payments_amount, 0)
  ) STORED;
