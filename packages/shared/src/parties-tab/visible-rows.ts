import type { PartiesTabFilterId } from "./constants";
import type { PartiesTabListRow } from "./schemas";
import { applyPartiesTabClientFilters } from "./client-filter";
import { mergeUniquePartyRows } from "./merge";

export function buildPartiesTabVisibleRows(args: {
  baselineRows: PartiesTabListRow[];
  serverRows: PartiesTabListRow[];
  filterId: PartiesTabFilterId;
  searchInputRaw: string;
}): PartiesTabListRow[] {
  const { baselineRows, serverRows, filterId, searchInputRaw } = args;
  const merged = mergeUniquePartyRows(
    applyPartiesTabClientFilters(baselineRows, filterId, searchInputRaw),
    applyPartiesTabClientFilters(serverRows, filterId, searchInputRaw)
  );
  merged.sort((a, b) => {
    if (b.outstanding_total !== a.outstanding_total) {
      return b.outstanding_total - a.outstanding_total;
    }
    const pendB = b.outstanding_rents + b.outstanding_charges;
    const pendA = a.outstanding_rents + a.outstanding_charges;
    if (pendB !== pendA) return pendB - pendA;
    return a.customer_name.localeCompare(b.customer_name, undefined, { sensitivity: "base" });
  });
  return merged;
}
