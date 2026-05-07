-- OTP signup/login: challenges table, profile email/terms, nullable audit warehouse + warehouse location.

-- ---------------------------------------------------------------------------
-- OTP challenges (server/service_role only)
-- ---------------------------------------------------------------------------
CREATE TABLE public.auth_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'login')),
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  resend_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX idx_auth_otp_challenges_user_created
  ON public.auth_otp_challenges (user_id, created_at DESC);

CREATE INDEX idx_auth_otp_challenges_id_unconsumed
  ON public.auth_otp_challenges (id)
  WHERE consumed_at IS NULL;

ALTER TABLE public.auth_otp_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.auth_otp_challenges FROM anon;
REVOKE ALL ON public.auth_otp_challenges FROM authenticated;
GRANT ALL ON public.auth_otp_challenges TO service_role;

-- ---------------------------------------------------------------------------
-- user_profiles: email, terms, verification
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN email text,
  ADD COLUMN terms_accepted_at timestamptz,
  ADD COLUMN email_verified_at timestamptz;

CREATE UNIQUE INDEX user_profiles_phone_key ON public.user_profiles (phone);

CREATE UNIQUE INDEX user_profiles_email_key ON public.user_profiles (email)
  WHERE email IS NOT NULL;

-- ---------------------------------------------------------------------------
-- audit_log: optional warehouse (tenant-level events)
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_log
  ALTER COLUMN warehouse_id DROP NOT NULL;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
    AND (
      warehouse_id IS NULL
      OR warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND (
      warehouse_id IS NULL
      OR warehouse_id IN (SELECT public.accessible_warehouse_ids())
    )
  );

-- ---------------------------------------------------------------------------
-- warehouses: optional city/state for onboarding MVP
-- ---------------------------------------------------------------------------
ALTER TABLE public.warehouses
  ALTER COLUMN city DROP NOT NULL,
  ALTER COLUMN state DROP NOT NULL;
