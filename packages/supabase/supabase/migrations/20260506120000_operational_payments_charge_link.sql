-- Link labor operational payments to product charge dimension; seed payment type per tenant.

ALTER TABLE public.operational_payments
ADD COLUMN IF NOT EXISTS product_charge_type_id uuid REFERENCES public.product_charges (product_charge_type_id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_op_payments_product_charge_type
  ON public.operational_payments (product_charge_type_id)
WHERE
  product_charge_type_id IS NOT NULL;

SELECT
  t.id,
  'Stock movement charges paid',
  'STOCK_MOVEMENT',
  TRUE
FROM
  public.tenants t
WHERE
  NOT EXISTS (
    SELECT
      1
    FROM
      public.payment_types pt
    WHERE
      pt.tenant_id = t.id
      AND pt.category = 'STOCK_MOVEMENT'
  );
