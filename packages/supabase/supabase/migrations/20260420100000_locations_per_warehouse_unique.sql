-- If an older copy of 20260419180000 created locations without warehouse_id,
-- add warehouse scope and per-warehouse unique name. No-op when warehouse_id already exists.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'locations'
      AND column_name = 'warehouse_id'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE public.locations
    ADD COLUMN warehouse_id uuid REFERENCES public.warehouses (id);

  UPDATE public.locations l
  SET warehouse_id = w.id
  FROM (
    SELECT DISTINCT ON (tenant_id) id, tenant_id
    FROM public.warehouses
    ORDER BY tenant_id, created_at ASC
  ) w
  WHERE l.tenant_id = w.tenant_id;

  ALTER TABLE public.locations
    ALTER COLUMN warehouse_id SET NOT NULL;

  ALTER TABLE public.locations
    DROP CONSTRAINT IF EXISTS locations_name_key;

  ALTER TABLE public.locations
    ADD CONSTRAINT locations_warehouse_name_key UNIQUE (warehouse_id, name);

  CREATE INDEX IF NOT EXISTS idx_locations_warehouse_id ON public.locations (warehouse_id);

  DROP POLICY IF EXISTS locations_select ON public.locations;
  DROP POLICY IF EXISTS locations_insert ON public.locations;
  DROP POLICY IF EXISTS locations_update ON public.locations;

  CREATE POLICY locations_select ON public.locations
    FOR SELECT USING (
      tenant_id = public.current_tenant_id()
      AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    );

  CREATE POLICY locations_insert ON public.locations
    FOR INSERT WITH CHECK (
      tenant_id = public.current_tenant_id()
      AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
      AND EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = warehouse_id
          AND w.tenant_id = tenant_id
      )
    );

  CREATE POLICY locations_update ON public.locations
    FOR UPDATE USING (
      tenant_id = public.current_tenant_id()
      AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
    WITH CHECK (
      tenant_id = public.current_tenant_id()
      AND warehouse_id IN (SELECT public.accessible_warehouse_ids())
      AND EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = warehouse_id
          AND w.tenant_id = tenant_id
      )
    );
END $$;
