import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PHONE_RE = /^\+91[6-9]\d{9}$/;
const ROLE_ALLOWED = new Set(["MANAGER", "STAFF"]);

interface Body {
  tenant_id?: string;
  user_id?: string;
  full_name?: string | null;
  phone?: string;
  email?: string;
  is_active?: boolean;
  role?: string;
  warehouse_ids?: string[];
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
    const targetUserId = body.user_id?.trim();

    if (!tenantId || !targetUserId) {
      return error("MISSING_FIELDS", "tenant_id and user_id are required", 400);
    }

    if (targetUserId === caller.id) {
      return error("FORBIDDEN", "Use Preferences to change your own account", 403);
    }

    const { data: gate } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!gate || gate.role !== "OWNER") {
      return error("FORBIDDEN", "Only owners can update users", 403);
    }

    const { data: targetRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", targetUserId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!targetRole) {
      return error("NOT_FOUND", "User is not in this organization", 404);
    }

    const patchProfile: Record<string, unknown> = {};

    if (body.full_name !== undefined) {
      const fn = typeof body.full_name === "string" ? body.full_name.trim() : "";
      if (fn.length < 2 || fn.length > 100) {
        return error("INVALID_INPUT", "Full name must be between 2 and 100 characters", 400);
      }
      patchProfile.display_name = fn;
    }

    if (body.phone !== undefined) {
      const phone = body.phone.trim();
      if (!PHONE_RE.test(phone)) {
        return error("INVALID_PHONE", "Enter a valid 10-digit Indian mobile number", 400);
      }
      const { data: other } = await adminClient.from("user_profiles").select("id").eq("phone", phone).maybeSingle();
      if (other && (other.id as string) !== targetUserId) {
        return error("PHONE_EXISTS", "Phone already registered", 409);
      }
      patchProfile.phone = phone;
    }

    if (body.email !== undefined) {
      const email = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return error("INVALID_EMAIL", "Enter a valid email address", 400);
      }
      const { data: other } = await adminClient.from("user_profiles").select("id").eq("email", email).maybeSingle();
      if (other && (other.id as string) !== targetUserId) {
        return error("EMAIL_EXISTS", "Email already registered", 409);
      }
      patchProfile.email = email;
    }

    if (body.is_active !== undefined) {
      patchProfile.is_active = Boolean(body.is_active);
    }

    const authPatch: {
      phone?: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
    } = {};

    if (patchProfile.phone !== undefined) authPatch.phone = patchProfile.phone as string;
    if (patchProfile.email !== undefined) authPatch.email = patchProfile.email as string;
    if (patchProfile.display_name !== undefined) {
      authPatch.user_metadata = { full_name: patchProfile.display_name };
    }

    if (Object.keys(authPatch).length > 0) {
      const { error: auErr } = await adminClient.auth.admin.updateUserById(targetUserId, authPatch);
      if (auErr) {
        console.error("auth update:", auErr);
        return error("UPDATE_FAILED", "Could not update login details", 500);
      }
    }

    if (Object.keys(patchProfile).length > 0) {
      const { error: profErr } = await adminClient.from("user_profiles").update(patchProfile).eq("id", targetUserId);
      if (profErr) {
        console.error("profile update:", profErr);
        return error("UPDATE_FAILED", "Could not update profile", 500);
      }
    }

    if (body.role !== undefined) {
      const role = body.role;
      if (!ROLE_ALLOWED.has(role)) {
        return error("INVALID_ROLE", "Role must be Manager or Staff", 400);
      }
      if (targetRole.role === "OWNER") {
        return error("FORBIDDEN", "Cannot change another owner's role here", 403);
      }
      const { error: rErr } = await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", targetUserId)
        .eq("tenant_id", tenantId);
      if (rErr) {
        console.error("role update:", rErr);
        const msg = rErr.message?.includes("LAST_OWNER") ? rErr.message : "Could not update role";
        return error("UPDATE_FAILED", msg, 400);
      }
    }

    if (body.warehouse_ids !== undefined) {
      const warehouseIds = Array.isArray(body.warehouse_ids) ? body.warehouse_ids : [];
      const uniqWh = [...new Set(warehouseIds)];
      if (uniqWh.length === 0) {
        return error("MISSING_FIELDS", "Select at least one warehouse", 400);
      }

      const { data: whRows } = await adminClient.from("warehouses").select("id").eq("tenant_id", tenantId);
      const validIds = new Set((whRows ?? []).map((w) => w.id as string));
      if (!uniqWh.every((id) => validIds.has(id))) {
        return error("INVALID_WAREHOUSES", "One or more warehouses are not in this organization", 400);
      }

      const { data: tenantWarehouses } = await adminClient.from("warehouses").select("id").eq("tenant_id", tenantId);

      const twIds = (tenantWarehouses ?? []).map((w) => w.id as string);

      await adminClient
        .from("user_warehouse_assignments")
        .delete()
        .eq("user_id", targetUserId)
        .in("warehouse_id", twIds);

      const { error: insErr } = await adminClient
        .from("user_warehouse_assignments")
        .insert(uniqWh.map((warehouse_id) => ({ user_id: targetUserId, warehouse_id })));

      if (insErr) {
        console.error("uwa replace:", insErr);
        return error("UPDATE_FAILED", "Could not update warehouses", 500);
      }
    }

    return json({ ok: true });
  } catch (err) {
    console.error("update-tenant-user:", err);
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
