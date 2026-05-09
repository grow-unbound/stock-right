import type { PartiesTabFilterId } from "./constants";
import type { PartiesTabListRow } from "./schemas";

function normalizeNeedle(raw: string): string {
  return raw.trim().toLowerCase();
}

export function partyRowMatchesSearch(row: PartiesTabListRow, searchRaw: string): boolean {
  const q = normalizeNeedle(searchRaw);
  if (q.length === 0) return true;
  const hay = [row.customer_code, row.customer_name, row.address].join(" ").toLowerCase();
  return hay.includes(q);
}

export function partyRowMatchesChip(row: PartiesTabListRow, filterId: PartiesTabFilterId): boolean {
  if (filterId === "all") return true;
  if (filterId === "outstanding_due") return row.outstanding_total > 0;
  if (filterId === "stale_lots") return row.stale_lot_count > 0;
  return true;
}

export function applyPartiesTabClientFilters(
  rows: PartiesTabListRow[],
  filterId: PartiesTabFilterId,
  searchRaw: string
): PartiesTabListRow[] {
  return rows.filter((r) => partyRowMatchesChip(r, filterId) && partyRowMatchesSearch(r, searchRaw));
}
