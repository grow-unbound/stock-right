import type { SupabaseClient } from "@supabase/supabase-js";

import type { StockTabFilterId } from "./constants";
import {
  stockMovementRowsSchema,
  type StockMovementRow,
  type StockSortColumn,
  type StockTabKpis,
  dailyStockSummaryKpiSchema,
} from "./schemas";

function filterToRpc(filterId: StockTabFilterId): string {
  return filterId;
}

function parseMovementRows(raw: unknown): StockMovementRow[] {
  const parsed = stockMovementRowsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export async function countStockMovements(
  client: SupabaseClient,
  args: {
    warehouseId: string;
    search: string;
    filterId: StockTabFilterId;
  }
): Promise<number> {
  const needle = args.search.trim();
  const { data, error } = await client.rpc("count_stock_movements", {
    p_warehouse_id: args.warehouseId,
    p_search: needle.length > 0 ? needle : null,
    p_filter: filterToRpc(args.filterId),
  });
  if (error) throw error;
  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function listStockMovements(
  client: SupabaseClient,
  args: {
    warehouseId: string;
    search: string;
    filterId: StockTabFilterId;
    sortColumn: StockSortColumn;
    sortDirection: "asc" | "desc";
    page: number;
    pageSize: number;
  }
): Promise<StockMovementRow[]> {
  const needle = args.search.trim();
  const { data, error } = await client.rpc("list_stock_movements", {
    p_warehouse_id: args.warehouseId,
    p_search: needle.length > 0 ? needle : null,
    p_filter: filterToRpc(args.filterId),
    p_sort_column: args.sortColumn,
    p_sort_direction: args.sortDirection,
    p_page: args.page,
    p_page_size: args.pageSize,
  });
  if (error) throw error;
  return parseMovementRows(data);
}

function mapSummaryToActiveKpis(row: Record<string, unknown>): Pick<
  StockTabKpis,
  "activeStockBags" | "activeStockLots" | "summaryDate"
> {
  const parsed = dailyStockSummaryKpiSchema.safeParse(row);
  if (!parsed.success) {
    return {
      activeStockBags: 0,
      activeStockLots: 0,
      summaryDate: null,
    };
  }
  const r = parsed.data;
  return {
    activeStockBags: r.fresh_bags_eod + r.aging_bags_eod,
    activeStockLots: r.fresh_lots_eod + r.aging_lots_eod,
    summaryDate: r.summary_date,
  };
}

export async function fetchStockTabKpis(
  client: SupabaseClient,
  warehouseId: string
): Promise<StockTabKpis | null> {
  const [summaryRes, staleRes] = await Promise.all([
    client
      .from("daily_stock_summary")
      .select(
        "summary_date, fresh_bags_eod, fresh_lots_eod, aging_bags_eod, aging_lots_eod, stale_bags_eod, stale_lots_eod"
      )
      .eq("warehouse_id", warehouseId)
      .order("summary_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    client.rpc("stock_tab_stale_kpis", { p_warehouse_id: warehouseId }),
  ]);

  if (summaryRes.error) throw summaryRes.error;
  if (staleRes.error) throw staleRes.error;

  const active = summaryRes.data
    ? mapSummaryToActiveKpis(summaryRes.data as Record<string, unknown>)
    : {
        activeStockBags: 0,
        activeStockLots: 0,
        summaryDate: null,
      };

  let staleStockBags = 0;
  let staleStockLots = 0;
  const staleRaw = staleRes.data;
  if (Array.isArray(staleRaw) && staleRaw.length > 0) {
    const first = staleRaw[0] as { stale_bags?: unknown; stale_lots?: unknown };
    staleStockBags = Number(first.stale_bags ?? 0);
    staleStockLots = Number(first.stale_lots ?? 0);
  }

  if (!summaryRes.data && staleStockBags === 0 && staleStockLots === 0) {
    return null;
  }

  return {
    ...active,
    staleStockBags,
    staleStockLots,
  };
}
