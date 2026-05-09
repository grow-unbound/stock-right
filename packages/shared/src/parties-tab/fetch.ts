import type { SupabaseClient } from "@supabase/supabase-js";

// Warehouse-scoped RPCs with merged local + debounced server search, pagination, and offline baseline
// cache on the client — same pattern as Money/Stock (specs/ARCHITECTURE_AND_DECISIONS.md, Decision 11).

import type { PartiesTabFilterId } from "./constants";
import { partiesFilterToRpc } from "./constants";
import {
  partiesTabKpisRpcSchema,
  partiesTabListRowsSchema,
  type PartiesTabKpis,
  type PartiesTabListRow,
} from "./schemas";

function parsePartyRows(raw: unknown): PartiesTabListRow[] {
  const parsed = partiesTabListRowsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function mapKpis(row: ReturnType<typeof partiesTabKpisRpcSchema.parse>): PartiesTabKpis {
  return {
    totalOutstanding: row.total_outstanding,
    customersWithOutstanding: row.customers_with_outstanding,
    staleStockBags: row.stale_stock_bags,
    partiesWithStale: row.parties_with_stale,
  };
}

export async function fetchPartiesTabKpis(
  client: SupabaseClient,
  warehouseId: string
): Promise<PartiesTabKpis | null> {
  const { data, error } = await client.rpc("parties_tab_kpis", {
    p_warehouse_id: warehouseId,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  const first = rows[0] as Record<string, unknown> | undefined;
  if (!first) {
    return {
      totalOutstanding: 0,
      customersWithOutstanding: 0,
      staleStockBags: 0,
      partiesWithStale: 0,
    };
  }
  const parsed = partiesTabKpisRpcSchema.safeParse(first);
  if (!parsed.success) return null;
  return mapKpis(parsed.data);
}

export async function countPartiesTab(
  client: SupabaseClient,
  args: {
    warehouseId: string;
    search: string;
    filterId: PartiesTabFilterId;
  }
): Promise<number> {
  const needle = args.search.trim();
  const { data, error } = await client.rpc("count_parties_tab", {
    p_warehouse_id: args.warehouseId,
    p_filter: partiesFilterToRpc(args.filterId),
    p_search: needle,
  });
  if (error) throw error;
  if (typeof data === "number") return data;
  return Number(data ?? 0);
}

export async function listPartiesTab(
  client: SupabaseClient,
  args: {
    warehouseId: string;
    search: string;
    filterId: PartiesTabFilterId;
    page: number;
    pageSize: number;
  }
): Promise<PartiesTabListRow[]> {
  const needle = args.search.trim();
  const { data, error } = await client.rpc("list_parties_tab", {
    p_warehouse_id: args.warehouseId,
    p_filter: partiesFilterToRpc(args.filterId),
    p_search: needle,
    p_page: args.page,
    p_page_size: args.pageSize,
  });
  if (error) throw error;
  return parsePartyRows(data);
}
