-- product_groups: tenant-scoped hierarchy; products must belong to a group.

CREATE TABLE public.product_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.current_tenant_id() REFERENCES public.tenants (id),
  name text NOT NULL,
  parent_product_group_id uuid REFERENCES public.product_groups (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_groups_tenant_id ON public.product_groups (tenant_id);
CREATE INDEX idx_product_groups_parent_id ON public.product_groups (parent_product_group_id);

CREATE TRIGGER set_product_groups_updated_at
  BEFORE UPDATE ON public.product_groups
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- Default group per tenant that still has catalog rows without a group
INSERT INTO public.product_groups (tenant_id, name)
SELECT DISTINCT p.tenant_id, 'General'
FROM public.products p
WHERE p.product_group_id IS NULL;

UPDATE public.products p
SET product_group_id = (
  SELECT g.id
  FROM public.product_groups g
  WHERE g.tenant_id = p.tenant_id
    AND g.name = 'General'
  ORDER BY g.created_at ASC
  LIMIT 1
)
WHERE p.product_group_id IS NULL;

ALTER TABLE public.products
  ALTER COLUMN product_group_id SET NOT NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_product_group_id_fkey
  FOREIGN KEY (product_group_id) REFERENCES public.product_groups (id) ON DELETE RESTRICT;

CREATE INDEX idx_products_product_group_id ON public.products (product_group_id);

ALTER TABLE public.product_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_groups_select ON public.product_groups
  FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY product_groups_insert ON public.product_groups
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      parent_product_group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = parent_product_group_id
          AND pg.tenant_id = public.current_tenant_id()
      )
    )
  );

CREATE POLICY product_groups_update ON public.product_groups
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      parent_product_group_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.product_groups pg
        WHERE pg.id = parent_product_group_id
          AND pg.tenant_id = public.current_tenant_id()
      )
    )
  );

DROP POLICY IF EXISTS products_insert ON public.products;
DROP POLICY IF EXISTS products_update ON public.products;

CREATE POLICY products_insert ON public.products
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.product_groups pg
      WHERE pg.id = product_group_id
        AND pg.tenant_id = tenant_id
    )
  );

CREATE POLICY products_update ON public.products
  FOR UPDATE USING (tenant_id = public.current_tenant_id())
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.product_groups pg
      WHERE pg.id = product_group_id
        AND pg.tenant_id = tenant_id
    )
  );

GRANT ALL ON public.product_groups TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_groups TO authenticated;
