import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole, UserSessionContext, Warehouse } from "../types/models";
import { initialsFromDisplayName, roleLabel as formatRoleLabel } from "../utils/user-display";

function readTenantName(tenants: unknown): string | null {
  if (tenants === null || tenants === undefined) return null;
  if (Array.isArray(tenants)) {
    const n = tenants[0];
    if (typeof n === "object" && n !== null && "name" in n) {
      return typeof (n as { name: unknown }).name === "string" ? (n as { name: string }).name : null;
    }
    return null;
  }
  if (typeof tenants === "object" && "name" in tenants) {
    const v = (tenants as { name: unknown }).name;
    return typeof v === "string" ? v : null;
  }
  return null;
}

export async function fetchUserSessionContext(
  client: SupabaseClient,
  activeWarehouseId: string | null
): Promise<UserSessionContext | null> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileErr } = await client
    .from("user_profiles")
    .select("id, display_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr || !profile) return null;

  const phone = profile.phone as string;
  const fullName = (profile.display_name as string | null) ?? null;
  const initials = initialsFromDisplayName(fullName, phone);

  let warehouseId: string | null = activeWarehouseId;
  let warehouseName: string | null = null;
  let tenantId: string | null = null;
  let tenantName: string | null = null;
  let role: UserRole | null = null;

  if (warehouseId) {
    const { data: wh } = await client
      .from("warehouses")
      .select(
        `id, warehouse_name, tenant_id, tenants(name),
         user_warehouse_assignments!inner(user_id)`
      )
      .eq("id", warehouseId)
      .eq("user_warehouse_assignments.user_id", user.id)
      .maybeSingle();

    if (wh) {
      warehouseName = wh.warehouse_name as string;
      tenantId = wh.tenant_id as string;
      tenantName = readTenantName(wh.tenants);
    } else {
      warehouseId = null;
    }
  }

  if (tenantId) {
    const { data: ur } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    role = (ur?.role as UserRole | undefined) ?? null;
  } else {
    const { data: ur } = await client
      .from("user_roles")
      .select("role, tenant_id, tenants(name)")
      .eq("user_id", user.id)
      .order("tenant_id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (ur) {
      role = (ur.role as UserRole | undefined) ?? null;
      tenantId = ur.tenant_id as string;
      tenantName = readTenantName(ur.tenants);
    }
  }

  return {
    userId: user.id,
    fullName,
    phone,
    initials,
    role,
    roleLabel: formatRoleLabel(role),
    tenantName,
    warehouseId,
    warehouseName,
  };
}

/** Maps verify-otp edge payload (snake_case DB row) to `Warehouse`. */
export function warehouseFromVerifyOtpRow(row: unknown): Warehouse | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.tenant_id !== "string") return null;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    warehouseName: typeof r.warehouse_name === "string" ? r.warehouse_name : "",
    warehouseCode: typeof r.warehouse_code === "string" ? r.warehouse_code : "",
    city: typeof r.city === "string" ? r.city : null,
    state: typeof r.state === "string" ? r.state : null,
    capacityBags: typeof r.capacity_bags === "number" ? r.capacity_bags : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
  };
}
