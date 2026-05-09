import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProductPickRow {
  product_id: string;
  product_name: string;
}

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function tenantIdForWarehouse(client: SupabaseClient, warehouseId: string): Promise<string> {
  const { data, error } = await client.from("warehouses").select("tenant_id").eq("id", warehouseId).maybeSingle();
  if (error) throw error;
  if (!data?.tenant_id) throw new Error("Warehouse not found or not accessible.");
  return data.tenant_id;
}

export async function searchProductsQuickPick(
  client: SupabaseClient,
  params: { warehouseId: string; q: string; limit: number; offset: number }
): Promise<{ rows: ProductPickRow[]; count: number | null }> {
  const tenantId = await tenantIdForWarehouse(client, params.warehouseId);
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const offset = Math.max(params.offset, 0);
  const needle = params.q.trim();

  let qb = client
    .from("products")
    .select("id, product_name", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (needle.length > 0) {
    const e = escapeIlike(needle);
    const p = `%${e}%`;
    qb = qb.ilike("product_name", p);
  }

  const { data, error, count } = await qb.order("product_name", { ascending: true }).range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    product_id: row.id,
    product_name: row.product_name,
  }));

  return { rows, count };
}
