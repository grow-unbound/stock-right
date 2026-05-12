import type { SupabaseClient } from "@supabase/supabase-js";

export interface PaymentTypePickRow {
  id: string;
  name: string;
  category: string;
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

export async function searchPaymentTypesQuickPick(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    q: string;
    limit: number;
    offset: number;
    excludeCategories?: readonly string[];
  }
): Promise<{ rows: PaymentTypePickRow[]; count: number | null }> {
  const tenantId = await tenantIdForWarehouse(client, params.warehouseId);
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const offset = Math.max(params.offset, 0);
  const needle = params.q.trim();
  const excluded = [...new Set((params.excludeCategories ?? []).filter((c) => c.length > 0))];

  let qb = client
    .from("payment_types")
    .select("id, name, category", { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  for (const cat of excluded) {
    qb = qb.neq("category", cat);
  }

  if (needle.length > 0) {
    const e = escapeIlike(needle);
    const p = `%${e}%`;
    qb = qb.ilike("name", p);
  }

  const { data, error, count } = await qb.order("name", { ascending: true }).range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
  }));

  return { rows, count };
}
