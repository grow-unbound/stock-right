-- OWNER-only tenant user management: RPC gate, RLS policies, safeguards.

-- ---------------------------------------------------------------------------
-- 1. RPC: tenant user admin gate (OWNER only, same tenant as current_tenant_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_tenant_users()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_id = public.current_tenant_id()
      AND ur.role = 'OWNER'::public.user_role
  );
$$;

ALTER FUNCTION public.user_can_manage_tenant_users() OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.user_can_manage_tenant_users() TO authenticated;

-- OWNER listing warehouses across tenant (for assigning teammates).
CREATE POLICY warehouses_select_owner_tenant_wide ON public.warehouses
  FOR SELECT
  USING (
    tenant_id = public.current_tenant_id()
    AND public.user_can_manage_tenant_users()
  );

-- ---------------------------------------------------------------------------
-- 2. Safeguards: last OWNER in tenant
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_demote_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.role = 'OWNER'::public.user_role
     AND NEW.role IS DISTINCT FROM OLD.role
     AND NEW.role <> 'OWNER'::public.user_role THEN
    IF (
      SELECT count(*)::integer
      FROM public.user_roles ur
      WHERE ur.tenant_id = OLD.tenant_id
        AND ur.role = 'OWNER'::public.user_role
    ) <= 1 THEN
      RAISE EXCEPTION 'LAST_OWNER_REQUIRED'
        USING ERRCODE = '23514',
        HINT = 'Assign another owner before changing this role.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_demote_last_owner ON public.user_roles;

CREATE TRIGGER trg_prevent_demote_last_owner
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_demote_last_owner();

CREATE OR REPLACE FUNCTION public.prevent_deactivate_last_active_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  tid uuid;
  other_active integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.is_active IS DISTINCT FROM FALSE
     AND NEW.is_active IS FALSE THEN
    FOR tid IN
      SELECT ur.tenant_id
      FROM public.user_roles ur
      WHERE ur.user_id = OLD.id
        AND ur.role = 'OWNER'::public.user_role
    LOOP
      SELECT count(*)::integer
      INTO other_active
      FROM public.user_roles ur
      INNER JOIN public.user_profiles up ON up.id = ur.user_id
      WHERE ur.tenant_id = tid
        AND ur.role = 'OWNER'::public.user_role
        AND up.is_active IS TRUE
        AND ur.user_id <> OLD.id;

      IF other_active = 0 THEN
        RAISE EXCEPTION 'LAST_ACTIVE_OWNER_REQUIRED'
          USING ERRCODE = '23514',
          HINT = 'Promote another owner before deactivating this account.';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_deactivate_last_owner ON public.user_profiles;

CREATE TRIGGER trg_prevent_deactivate_last_owner
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.prevent_deactivate_last_active_owner();

-- ---------------------------------------------------------------------------
-- 3. user_profiles: OWNER may read/update other tenant members (not self via this policy)
-- ---------------------------------------------------------------------------

CREATE POLICY user_profiles_owner_select_tenant ON public.user_profiles
  FOR SELECT
  USING (
    public.user_can_manage_tenant_users()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = public.user_profiles.id
        AND ur.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY user_profiles_owner_update_tenant_member ON public.user_profiles
  FOR UPDATE
  USING (
    public.user_can_manage_tenant_users()
    AND public.user_profiles.id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = public.user_profiles.id
        AND ur.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = public.user_profiles.id
        AND ur.tenant_id = public.current_tenant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. user_roles: OWNER may read/update tenant role rows
-- ---------------------------------------------------------------------------

CREATE POLICY user_roles_owner_select_tenant ON public.user_roles
  FOR SELECT
  USING (
    public.user_can_manage_tenant_users()
    AND tenant_id = public.current_tenant_id()
  );

CREATE POLICY user_roles_owner_update_tenant ON public.user_roles
  FOR UPDATE
  USING (
    public.user_can_manage_tenant_users()
    AND tenant_id = public.current_tenant_id()
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND user_id <> auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5. user_warehouse_assignments: OWNER may manage assignments for tenant warehouses
-- ---------------------------------------------------------------------------

CREATE POLICY uwa_owner_select_tenant ON public.user_warehouse_assignments
  FOR SELECT
  USING (
    public.user_can_manage_tenant_users()
    AND EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = public.user_warehouse_assignments.warehouse_id
        AND w.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = public.user_warehouse_assignments.user_id
        AND ur.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY uwa_owner_insert_tenant ON public.user_warehouse_assignments
  FOR INSERT
  WITH CHECK (
    public.user_can_manage_tenant_users()
    AND EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = warehouse_id
        AND w.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = user_id
        AND ur.tenant_id = public.current_tenant_id()
    )
  );

CREATE POLICY uwa_owner_delete_tenant ON public.user_warehouse_assignments
  FOR DELETE
  USING (
    public.user_can_manage_tenant_users()
    AND EXISTS (
      SELECT 1
      FROM public.warehouses w
      WHERE w.id = public.user_warehouse_assignments.warehouse_id
        AND w.tenant_id = public.current_tenant_id()
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = public.user_warehouse_assignments.user_id
        AND ur.tenant_id = public.current_tenant_id()
    )
  );
