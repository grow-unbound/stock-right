import type { SupabaseClient } from "@supabase/supabase-js";

import type { PartiesTabRow } from "./parties";

function toPartiesTabRow(r: {
  id: string;
  customer_code: string;
  customer_name: string;
  phone: string | null;
  mobile: string | null;
  address: string | null;
}): PartiesTabRow {
  return {
    customer_id: r.id,
    customer_code: r.customer_code,
    customer_name: r.customer_name,
    phone: r.phone ?? "",
    mobile: r.mobile ?? "",
    address: r.address ?? "",
    outstanding: 0,
    lot_count: 0,
    bag_count: 0,
    last_activity_date: null,
    has_stock: false,
    filter_total: 0,
  };
}

/** Escape `%` / `_` for PostgREST `ilike` filters. */
function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Fast party picker: active customers only, indexed columns — used for initial paint + search.
 * Semantics: `customers.is_active` for this warehouse (names/codes for picker).
 */
export async function searchCustomersQuickPick(
  client: SupabaseClient,
  params: { warehouseId: string; q: string; limit: number; offset: number }
): Promise<{ rows: PartiesTabRow[]; count: number | null }> {
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const offset = Math.max(params.offset, 0);
  const needle = params.q.trim();

  let qb = client
    .from("customers")
    .select("id, customer_code, customer_name, phone, mobile, address", { count: "exact" })
    .eq("warehouse_id", params.warehouseId)
    .eq("is_active", true);

  if (needle.length > 0) {
    const e = escapeIlike(needle);
    const p = `%${e}%`;
    qb = qb.or(`customer_name.ilike.${p},customer_code.ilike.${p},phone.ilike.${p},mobile.ilike.${p}`);
  }

  const { data, error, count } = await qb
    .order("customer_name", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row) =>
    toPartiesTabRow({
      id: row.id,
      customer_code: row.customer_code,
      customer_name: row.customer_name,
      phone: row.phone,
      mobile: row.mobile,
      address: row.address,
    })
  );

  return { rows, count };
}
