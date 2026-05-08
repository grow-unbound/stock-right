import type { SupabaseClient } from "@supabase/supabase-js";
import type { Warehouse } from "../types/models";
import type { CreateWarehouseInput } from "../utils/validation";

export async function listWarehouses(
  client: SupabaseClient,
  userId: string
): Promise<Warehouse[]> {
  const { data, error } = await client
    .from("warehouses")
    .select(
      `id, tenant_id, warehouse_name, warehouse_code, city, state,
       capacity_bags, created_at,
       user_warehouse_assignments!inner(user_id)`
    )
    .eq("user_warehouse_assignments.user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    tenantId: row.tenant_id as string,
    warehouseName: row.warehouse_name as string,
    warehouseCode: row.warehouse_code as string,
    city: row.city as string | null,
    state: row.state as string | null,
    capacityBags: row.capacity_bags as number | null,
    createdAt: row.created_at as string,
  }));
}

export async function createWarehouse(
  supabaseUrl: string,
  accessToken: string,
  input: CreateWarehouseInput
): Promise<{ warehouseId: string }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/create-warehouse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: input.warehouseName,
      location: input.location,
      capacity_tonnes: input.capacityTonnes,
    }),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const o = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    throw new Error(typeof o.error === "string" ? o.error : "Failed to create warehouse");
  }
  if (typeof data !== "object" || data === null) throw new Error("Invalid response");
  const wid = (data as Record<string, unknown>).warehouse_id;
  if (typeof wid !== "string") throw new Error("Invalid response");
  return { warehouseId: wid };
}
