BEGIN;

ALTER TABLE public.lots
ADD COLUMN IF NOT EXISTS lot_number text;

UPDATE public.lots
SET lot_number = concat(id::text, '/', original_bags::text)
WHERE lot_number IS NULL;

ALTER TABLE public.lots
ALTER COLUMN lot_number SET NOT NULL;

ALTER TABLE public.lots
ADD CONSTRAINT lots_lot_number_format_check
CHECK (lot_number ~ '^[A-Za-z0-9]+/[A-Za-z0-9]+$');

ALTER TABLE public.lots
ADD CONSTRAINT lots_warehouse_lot_number_unique
UNIQUE (warehouse_id, lot_number);

DROP POLICY IF EXISTS lots_select ON public.lots;

CREATE POLICY lots_select ON public.lots
FOR SELECT USING (
  tenant_id = public.current_tenant_id()
  AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
  AND (
    status <> 'WRITTEN_OFF'
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = public.current_tenant_id()
        AND ur.role IN ('OWNER', 'MANAGER')
    )
  )
);

COMMIT;
