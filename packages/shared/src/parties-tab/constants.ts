import type { LandingFilterChip } from "../demo/landing-mock";

export const PARTIES_TAB_SEARCH_PLACEHOLDER = "Search customers …" as const;

export const PARTIES_TAB_FILTER_CHIPS: LandingFilterChip[] = [
  { id: "all", label: "All" },
  { id: "outstanding_due", label: "Outstanding Due" },
  { id: "stale_lots", label: "Stale Lots" },
];

export type PartiesTabFilterId = "all" | "outstanding_due" | "stale_lots";

const PARTIES_FILTER_ID_SET = new Set<PartiesTabFilterId>(["all", "outstanding_due", "stale_lots"]);

export function isPartiesTabFilterId(id: string): id is PartiesTabFilterId {
  return PARTIES_FILTER_ID_SET.has(id as PartiesTabFilterId);
}

export function partiesFilterToRpc(id: PartiesTabFilterId): PartiesTabFilterId {
  return id;
}

export const PARTIES_TAB_CACHE_PREFIX = "parties_tab_v1_" as const;

export function partiesTabCacheKey(warehouseId: string): string {
  return `${PARTIES_TAB_CACHE_PREFIX}${warehouseId}`;
}
