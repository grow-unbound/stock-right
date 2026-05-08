import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return error("UNAUTHORIZED", "Missing authorization", 401);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the caller's JWT
  const jwt = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await adminClient.auth.getUser(jwt);
  if (authErr || !user) return error("UNAUTHORIZED", "Invalid session", 401);

  try {
    const body = await req.json() as {
      tenant_id: string;
      name: string;
      location?: string;
      capacity_tonnes?: number;
    };

    if (!body.tenant_id || !body.name?.trim()) {
      return error("MISSING_FIELDS", "tenant_id and name are required", 400);
    }

    // Verify user belongs to this tenant
    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();

    if (!role) return error("FORBIDDEN", "Not a member of this tenant", 403);

    // Generate a simple warehouse code from the name
    const warehouseCode = body.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6) || "WH001";

    const { data: warehouse, error: whErr } = await adminClient
      .from("warehouses")
      .insert({
        tenant_id: body.tenant_id,
        warehouse_name: body.name.trim(),
        warehouse_code: warehouseCode,
        city: body.location?.trim() ?? null,
        capacity_bags: body.capacity_tonnes ? body.capacity_tonnes * 20 : null,
        created_by: user.id,
      })
      .select("id, warehouse_name")
      .single();

    if (whErr || !warehouse) {
      console.error("warehouse insert:", whErr);
      return error("CREATE_FAILED", "Could not create warehouse", 500);
    }

    // Create default warehouse_settings
    await adminClient.from("warehouse_settings").insert({
      warehouse_id: warehouse.id,
      tenant_id: body.tenant_id,
      blanket_stale_days: 180,
      follow_up_outstanding_days: 15,
      yearly_rent_cutoff_month: 5,
      yearly_rent_cutoff_day: 31,
      grace_period_months: 3,
    });

    // Assign user to warehouse
    await adminClient.from("user_warehouse_assignments").insert({
      user_id: user.id,
      warehouse_id: warehouse.id,
    });

    return json({ warehouse_id: warehouse.id, name: warehouse.warehouse_name });
  } catch (err) {
    console.error("create-warehouse error:", err);
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
