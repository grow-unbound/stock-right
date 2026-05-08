import type { SupabaseClient } from "@supabase/supabase-js";

export interface PartiesTabRow {
  customer_id: string;
  customer_code: string;
  customer_name: string;
  phone: string;
  mobile: string;
  address: string;
  outstanding: number;
  lot_count: number;
  bag_count: number;
  last_activity_date: string | null;
  has_stock: boolean;
  filter_total: number;
}

export async function listPartiesTabPage(
  client: SupabaseClient,
  params: {
    warehouseId: string;
    /** Same semantics as Parties tab — use `'active'` for the standard party list. */
    filter: "all" | "active" | "pending";
    search: string;
    limit: number;
    offset: number;
  }
): Promise<{ rows: PartiesTabRow[]; filterTotal: number }> {
  const { data, error } = await client.rpc("list_parties_tab", {
    p_warehouse_id: params.warehouseId,
    p_filter: params.filter,
    p_search: params.search.trim() === "" ? "" : params.search.trim(),
    p_limit: params.limit,
    p_offset: params.offset,
  });

  if (error) throw error;

  const rowsRaw = (data ?? []) as PartiesTabRow[];
  const filterTotal = rowsRaw.length > 0 ? rowsRaw[0].filter_total : 0;
  return { rows: rowsRaw, filterTotal };
}
