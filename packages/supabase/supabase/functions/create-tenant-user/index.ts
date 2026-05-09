import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PHONE_RE = /^\+91[6-9]\d{9}$/;
const ROLE_ALLOWED = new Set(["MANAGER", "STAFF"]);

interface Body {
  tenant_id?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  warehouse_ids?: string[];
  role?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("UNAUTHORIZED", "Missing authorization", 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  const {
    data: { user: caller },
    error: authErr,
  } = await adminClient.auth.getUser(jwt);
  if (authErr || !caller) return error("UNAUTHORIZED", "Invalid session", 401);

  try {
    const body = (await req.json()) as Body;
    const tenantId = body.tenant_id?.trim();
    const fullName = body.full_name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim().toLowerCase();
    const warehouseIds = Array.isArray(body.warehouse_ids) ? body.warehouse_ids : [];
    const role = body.role && ROLE_ALLOWED.has(body.role) ? body.role : "STAFF";

    if (!tenantId || !fullName || !phone || !email) {
      return error("MISSING_FIELDS", "tenant_id, full_name, phone, and email are required", 400);
    }
    if (!PHONE_RE.test(phone)) {
      return error("INVALID_PHONE", "Enter a valid 10-digit Indian mobile number", 400);
    }
    if (warehouseIds.length === 0) {
      return error("MISSING_FIELDS", "Select at least one warehouse", 400);
    }

    const { data: gate } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!gate || gate.role !== "OWNER") {
      return error("FORBIDDEN", "Only owners can add users", 403);
    }

    const { data: whRows } = await adminClient.from("warehouses").select("id").eq("tenant_id", tenantId);

    const validIds = new Set((whRows ?? []).map((w) => w.id as string));
    const uniqWh = [...new Set(warehouseIds)];
    if (!uniqWh.every((id) => validIds.has(id))) {
      return error("INVALID_WAREHOUSES", "One or more warehouses are not in this organization", 400);
    }

    const { data: dupPhone } = await adminClient.from("user_profiles").select("id").eq("phone", phone).maybeSingle();
    if (dupPhone) {
      return error("PHONE_EXISTS", "Phone already registered", 409);
    }

    const { data: dupEmail } = await adminClient.from("user_profiles").select("id").eq("email", email).maybeSingle();
    if (dupEmail) {
      return error("EMAIL_EXISTS", "Email already registered", 409);
    }

    const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
      phone,
      email,
      user_metadata: { full_name: fullName },
      phone_confirm: false,
      email_confirm: false,
    });

    if (createErr || !authUser?.user) {
      console.error("createUser:", JSON.stringify(createErr));
      return error("CREATE_USER_FAILED", "Could not create login for this user", 500);
    }

    const newId = authUser.user.id;

    const { error: profErr } = await adminClient.from("user_profiles").upsert({
      id: newId,
      phone,
      display_name: fullName,
      email,
      is_active: true,
    });

    if (profErr) {
      console.error("profile upsert:", profErr);
      await adminClient.auth.admin.deleteUser(newId);
      return error("CREATE_FAILED", "Could not save profile", 500);
    }

    const { error: roleErr } = await adminClient.from("user_roles").insert({
      user_id: newId,
      tenant_id: tenantId,
      role,
    });

    if (roleErr) {
      console.error("role insert:", roleErr);
      await adminClient.from("user_profiles").delete().eq("id", newId);
      await adminClient.auth.admin.deleteUser(newId);
      return error("CREATE_FAILED", "Could not assign role", 500);
    }

    const uwaRows = uniqWh.map((warehouse_id) => ({
      user_id: newId,
      warehouse_id,
    }));

    const { error: uwaErr } = await adminClient.from("user_warehouse_assignments").insert(uwaRows);

    if (uwaErr) {
      console.error("uwa insert:", uwaErr);
      await adminClient.from("user_roles").delete().eq("user_id", newId).eq("tenant_id", tenantId);
      await adminClient.from("user_profiles").delete().eq("id", newId);
      await adminClient.auth.admin.deleteUser(newId);
      return error("CREATE_FAILED", "Could not assign warehouses", 500);
    }

    return json({ user_id: newId });
  } catch (err) {
    console.error("create-tenant-user:", err);
    return error("INTERNAL", "Something went wrong", 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(code: string, message: string, status: number): Response {
  return json({ error: message, code }, status);
}
