import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { challengeId, code } = await req.json() as { challengeId: string; code: string };

    if (!challengeId || !code || code.length !== 6) {
      return error("INVALID_INPUT", "challengeId and 6-digit code are required", 400);
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fetch challenge
    const { data: challenge } = await adminClient
      .from("auth_otp_challenges")
      .select("id, user_id, purpose, otp_hash, expires_at, attempt_count, locked_until, consumed_at")
      .eq("id", challengeId)
      .maybeSingle();

    if (!challenge) {
      return error("INVALID_CODE", "Code is incorrect. Try again.", 400);
    }
    if (challenge.consumed_at) {
      return error("ALREADY_USED", "Code already used. Request a new one.", 400);
    }
    if (new Date(challenge.expires_at as string) < new Date()) {
      return error("EXPIRED_CODE", "Code expired. Request a new one.", 400);
    }
    if (challenge.locked_until && new Date(challenge.locked_until as string) > new Date()) {
      return error("TOO_MANY_ATTEMPTS", "Too many attempts. Try again in 5 minutes.", 429);
    }

    // Verify hash
    const [salt, storedHash] = (challenge.otp_hash as string).split(":");
    const inputHash = await hashOtp(code, salt!);
    const isValid = inputHash === storedHash;

    if (!isValid) {
      const newAttempts = (challenge.attempt_count as number) + 1;
      const updatePayload: Record<string, unknown> = { attempt_count: newAttempts };
      if (newAttempts >= MAX_ATTEMPTS) {
        updatePayload.locked_until = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      await adminClient
        .from("auth_otp_challenges")
        .update(updatePayload)
        .eq("id", challengeId);

      if (newAttempts >= MAX_ATTEMPTS) {
        return error("TOO_MANY_ATTEMPTS", "Too many attempts. Try again in 5 minutes.", 429);
      }
      return error("INVALID_CODE", "Code is incorrect. Try again.", 400);
    }

    // Mark consumed
    await adminClient
      .from("auth_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challengeId);

    const userId = challenge.user_id as string;
    const purpose = challenge.purpose as string;

    // For signup: create user_profiles, tenant, user_roles
    if (purpose === "signup") {
      await provisionNewUser(adminClient, userId);
    }

    const { data: profileGate } = await adminClient
      .from("user_profiles")
      .select("is_active")
      .eq("id", userId)
      .maybeSingle();
    if (profileGate?.is_active === false) {
      return error("ACCOUNT_INACTIVE", "This account is inactive", 403);
    }

    // Confirm user identities — our OTP flow is the verification.
    // Users created via createUser() have email_confirmed_at=null by default,
    // and GoTrue refuses to issue tokens for unconfirmed users.
    const { error: confirmErr } = await adminClient.auth.admin.updateUserById(userId, {
      email_confirm: true,
      phone_confirm: true,
    });
    if (confirmErr) {
      console.error("confirmUser error:", JSON.stringify(confirmErr));
      return error("SESSION_FAILED", "Could not confirm user identity", 500);
    }

    // auth.admin.createSession does not exist on supabase-js v2 at runtime.
    // Workaround: generateLink produces a hashed token; verifyOtp exchanges it for a real session.
    const { data: userData } = await adminClient.auth.admin.getUserById(userId);
    const userEmail = userData?.user?.email;
    if (!userEmail) {
      return error("SESSION_FAILED", "User has no email on file", 500);
    }

    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
      options: { shouldCreateUser: false },
    });
    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("generateLink error:", JSON.stringify(linkErr));
      return error("SESSION_FAILED", "Could not generate session token", 500);
    }

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionData, error: sessionErr } = await anonClient.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "email",
    });
    if (sessionErr || !sessionData?.session) {
      console.error("verifyOtp error:", JSON.stringify(sessionErr));
      return error("SESSION_FAILED", "Could not create session", 500);
    }

    // Determine next step based on warehouse count
    const { count: warehouseCount } = await adminClient
      .from("user_warehouse_assignments")
      .select("warehouse_id", { count: "exact", head: true })
      .eq("user_id", userId);

    let nextStep: "create_warehouse" | "select_warehouse" | "home";
    let warehouses: unknown[] = [];

    if ((warehouseCount ?? 0) === 0) {
      nextStep = "create_warehouse";
    } else if ((warehouseCount ?? 0) === 1) {
      nextStep = "home";
      const { data } = await adminClient
        .from("warehouses")
        .select("id, warehouse_name, warehouse_code, city, state, tenant_id, capacity_bags, created_at")
        .in(
          "id",
          (
            await adminClient
              .from("user_warehouse_assignments")
              .select("warehouse_id")
              .eq("user_id", userId)
          ).data?.map((r) => r.warehouse_id) ?? []
        );
      warehouses = data ?? [];
    } else {
      nextStep = "select_warehouse";
      const { data } = await adminClient
        .from("warehouses")
        .select("id, warehouse_name, warehouse_code, city, state, tenant_id, capacity_bags, created_at")
        .in(
          "id",
          (
            await adminClient
              .from("user_warehouse_assignments")
              .select("warehouse_id")
              .eq("user_id", userId)
          ).data?.map((r) => r.warehouse_id) ?? []
        );
      warehouses = data ?? [];
    }

    return json({
      session: {
        accessToken: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
        userId,
        expiresAt: sessionData.session.expires_at,
      },
      nextStep,
      warehouses,
    });
  } catch (err) {
    console.error("verify-otp error:", err);
    return error("INTERNAL", "Something went wrong", 500);
  }
});

async function provisionNewUser(
  adminClient: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  // Get user metadata set during signup
  const { data: authUser } = await adminClient.auth.admin.getUserById(userId);
  const meta = authUser?.user?.user_metadata ?? {};

  // Create tenant
  const { data: tenant } = await adminClient
    .from("tenants")
    .insert({ name: (meta.company_name as string) ?? "My Company", created_by: userId })
    .select("id")
    .single();
  if (!tenant) return;

  // Create user_profiles row
  const { data: authUserFull } = await adminClient.auth.admin.getUserById(userId);
  await adminClient.from("user_profiles").upsert({
    id: userId,
    phone: authUserFull?.user?.phone ?? "",
    display_name: (meta.full_name as string) ?? null,
    email: authUserFull?.user?.email ?? null,
    is_active: true,
  });

  // Assign OWNER role
  await adminClient
    .from("user_roles")
    .insert({ user_id: userId, tenant_id: tenant.id, role: "OWNER" });
}

async function hashOtp(otp: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${salt}:${otp}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: message, code }, status);
}
