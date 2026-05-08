import type { LandingFilterChip } from "../demo/landing-mock";

export const STOCK_TAB_SEARCH_PLACEHOLDER = "Search lots, products, customers..." as const;

export const STOCK_TAB_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All" },
  { id: "inward", label: "Inward" },
  { id: "outward", label: "Outward" },
  { id: "stale", label: "Stale" },
];

export type StockTabFilterId = (typeof STOCK_TAB_FILTER_CHIPS)[number]["id"];

const STOCK_FILTER_ID_SET = new Set<string>(STOCK_TAB_FILTER_CHIPS.map((c) => c.id));

export function isStockTabFilterId(id: string): id is StockTabFilterId {
  return STOCK_FILTER_ID_SET.has(id);
}

export const STOCK_TAB_CACHE_PREFIX = "stock_tab_v1_" as const;

export function stockTabCacheKey(warehouseId: string): string {
  return `${STOCK_TAB_CACHE_PREFIX}${warehouseId}`;
}
