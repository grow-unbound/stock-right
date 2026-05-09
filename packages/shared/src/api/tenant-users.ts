import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "../types/models";
import type { CreateTenantUserInput, UpdateTenantUserInput } from "../utils/validation";
import { createTenantUserInputSchema, updateTenantUserInputSchema } from "../utils/validation";

export interface TenantUserRow {
  userId: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  isActive: boolean;
  role: UserRole;
  warehouseIds: string[];
}

export async function fetchCanManageTenantUsers(client: SupabaseClient): Promise<boolean> {
  const { data, error } = await client.rpc("user_can_manage_tenant_users");
  if (error) return false;
  return Boolean(data);
}

export async function resolveTenantIdFromWarehouse(
  client: SupabaseClient,
  warehouseId: string | null
): Promise<string | null> {
  if (!warehouseId) return null;
  const { data, error } = await client
    .from("warehouses")
    .select("tenant_id")
    .eq("id", warehouseId)
    .maybeSingle();
  if (error || !data) return null;
  return data.tenant_id as string;
}

export async function listTenantUsers(
  client: SupabaseClient,
  tenantId: string
): Promise<TenantUserRow[]> {
  const { data: roleRows, error: rErr } = await client
    .from("user_roles")
    .select("user_id, role")
    .eq("tenant_id", tenantId);
  if (rErr) throw rErr;

  const roles = roleRows ?? [];
  if (roles.length === 0) return [];

  const userIds = [...new Set(roles.map((r) => r.user_id as string))];

  const { data: profiles, error: pErr } = await client
    .from("user_profiles")
    .select("id, display_name, phone, email, is_active")
    .in("id", userIds);
  if (pErr) throw pErr;

  const { data: uwa, error: uErr } = await client
    .from("user_warehouse_assignments")
    .select("user_id, warehouse_id")
    .in("user_id", userIds);
  if (uErr) throw uErr;

  const { data: whRows, error: wErr } = await client.from("warehouses").select("id").eq("tenant_id", tenantId);
  if (wErr) throw wErr;
  const tenantWh = new Set((whRows ?? []).map((w) => w.id as string));

  const whByUser = new Map<string, string[]>();
  for (const row of uwa ?? []) {
    const wid = row.warehouse_id as string;
    if (!tenantWh.has(wid)) continue;
    const uid = row.user_id as string;
    const arr = whByUser.get(uid);
    if (arr) arr.push(wid);
    else whByUser.set(uid, [wid]);
  }

  const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  const rows: TenantUserRow[] = roles.map((r) => {
    const uid = r.user_id as string;
    const p = profById.get(uid);
    return {
      userId: uid,
      fullName: (p?.display_name as string | null) ?? null,
      phone: (p?.phone as string) ?? "",
      email: (p?.email as string | null) ?? null,
      isActive: Boolean(p?.is_active),
      role: r.role as UserRole,
      warehouseIds: whByUser.get(uid) ?? [],
    };
  });

  rows.sort((a, b) => {
    const an = (a.fullName ?? a.phone).toLowerCase();
    const bn = (b.fullName ?? b.phone).toLowerCase();
    return an.localeCompare(bn);
  });

  return rows;
}

async function readAccessToken(client: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Not authenticated");
  return accessToken;
}

export async function createTenantUser(
  client: SupabaseClient,
  supabaseUrl: string,
  input: CreateTenantUserInput
): Promise<{ userId: string }> {
  const parsed = createTenantUserInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const accessToken = await readAccessToken(client);
  const res = await fetch(`${supabaseUrl}/functions/v1/create-tenant-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tenant_id: parsed.data.tenantId,
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      warehouse_ids: parsed.data.warehouseIds,
      role: parsed.data.role,
    }),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const o = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    throw new Error(typeof o.error === "string" ? o.error : "Could not create user");
  }
  if (typeof data !== "object" || data === null) throw new Error("Invalid response");
  const uid = (data as Record<string, unknown>).user_id;
  if (typeof uid !== "string") throw new Error("Invalid response");
  return { userId: uid };
}

export async function updateTenantUser(
  client: SupabaseClient,
  supabaseUrl: string,
  input: UpdateTenantUserInput
): Promise<void> {
  const parsed = updateTenantUserInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? "Invalid input");
  }

  const accessToken = await readAccessToken(client);
  const body: Record<string, unknown> = {
    tenant_id: parsed.data.tenantId,
    user_id: parsed.data.userId,
  };

  if (parsed.data.fullName !== undefined) body.full_name = parsed.data.fullName;
  if (parsed.data.phone !== undefined) body.phone = parsed.data.phone;
  if (parsed.data.email !== undefined) body.email = parsed.data.email;
  if (parsed.data.isActive !== undefined) body.is_active = parsed.data.isActive;
  if (parsed.data.role !== undefined) body.role = parsed.data.role;
  if (parsed.data.warehouseIds !== undefined) body.warehouse_ids = parsed.data.warehouseIds;

  const res = await fetch(`${supabaseUrl}/functions/v1/update-tenant-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const o = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    throw new Error(typeof o.error === "string" ? o.error : "Could not update user");
  }
}
