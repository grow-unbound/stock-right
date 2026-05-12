import type { SupabaseClient } from "@supabase/supabase-js";

export interface LotPickRow {
  lot_id: string;
  lot_number: string;
  customer_name: string;
  customer_code: string;
  product_name: string;
  balance_bags: number;
  product_id: string;
  status: string;
}

export interface SearchLotsQuickPickParams {
  warehouseId: string;
  q: string;
  limit: number;
  offset: number;
  /** When set, only lots for this customer; search applies to lot number (and party match is implicit). */
  customerId?: string;
  /** Filter by lot status (e.g. ACTIVE + STALE for dispatch). Omit for all statuses. */
  statusIn?: readonly string[];
  /** When true, only lots with balance_bags > 0. */
  positiveBalanceOnly?: boolean;
}

function escapeIlike(q: string): string {
  return q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export async function searchLotsQuickPick(
  client: SupabaseClient,
  params: SearchLotsQuickPickParams
): Promise<{ rows: LotPickRow[]; count: number | null }> {
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const offset = Math.max(params.offset, 0);
  const needle = params.q.trim();
  const p = needle.length > 0 ? `%${escapeIlike(needle)}%` : null;

  let customerIds: string[] = [];
  if (p && !params.customerId) {
    const { data: custRows, error: cErr } = await client
      .from("customers")
      .select("id")
      .eq("warehouse_id", params.warehouseId)
      .or(`customer_name.ilike.${p},customer_code.ilike.${p}`);

    if (cErr) throw cErr;
    customerIds = (custRows ?? []).map((r) => r.id).filter(Boolean);
  }

  let qb = client
    .from("lots")
    .select(
      "id, lot_number, balance_bags, product_id, status, customers!inner(customer_name, customer_code), products!inner(product_name)",
      { count: "exact" }
    )
    .eq("warehouse_id", params.warehouseId);

  if (params.customerId) {
    qb = qb.eq("customer_id", params.customerId);
  }

  if (params.statusIn && params.statusIn.length > 0) {
    qb = qb.in("status", [...params.statusIn]);
  }

  if (params.positiveBalanceOnly) {
    qb = qb.gt("balance_bags", 0);
  }

  if (p) {
    if (params.customerId) {
      qb = qb.or(`lot_number.ilike.${p}`);
    } else {
      const parts: string[] = [`lot_number.ilike.${p}`];
      if (customerIds.length > 0) {
        parts.push(`customer_id.in.(${customerIds.join(",")})`);
      }
      qb = qb.or(parts.join(","));
    }
  }

  const { data, error, count } = await qb
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const rows = (data ?? []).map((row: Record<string, unknown>) => {
    const customers = row.customers as { customer_name: string; customer_code: string } | null;
    const products = row.products as { product_name: string } | null;
    return {
      lot_id: row.id as string,
      lot_number: row.lot_number as string,
      customer_name: customers?.customer_name ?? "",
      customer_code: customers?.customer_code ?? "",
      product_name: products?.product_name ?? "",
      balance_bags: Number(row.balance_bags ?? 0),
      product_id: row.product_id as string,
      status: String(row.status ?? ""),
    };
  });

  return { rows, count };
}
