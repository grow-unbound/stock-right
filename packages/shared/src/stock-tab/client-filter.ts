import type { StockMovementRow } from "./schemas";
import type { StockTabFilterId } from "./constants";

function normalizeNeedle(raw: string): string {
  return raw.trim().toLowerCase();
}

function formatStockRowDateForSearch(txDate: string): string {
  const d = new Date(`${txDate}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return txDate;
  const ddMonYyyy = d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const iso = txDate.slice(0, 10);
  return `${ddMonYyyy} ${iso}`;
}

export function stockMovementMatchesSearch(row: StockMovementRow, searchRaw: string): boolean {
  const q = normalizeNeedle(searchRaw);
  if (q.length === 0) return true;
  const hay = [
    row.customer_code,
    row.customer_name,
    row.product_name,
    row.lot_number,
    row.tx_date,
    formatStockRowDateForSearch(row.tx_date),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function stockMovementMatchesFilter(row: StockMovementRow, filterId: StockTabFilterId): boolean {
  if (filterId === "all") return true;
  if (filterId === "inward") return row.transaction_type === "lodgement";
  if (filterId === "outward") return row.transaction_type === "delivery";
  if (filterId === "stale") return row.lot_status === "STALE" && row.balance_bags > 0;
  return true;
}

export function applyStockTabClientFilters(
  rows: StockMovementRow[],
  filterId: StockTabFilterId,
  searchRaw: string
): StockMovementRow[] {
  return rows.filter(
    (r) => stockMovementMatchesFilter(r, filterId) && stockMovementMatchesSearch(r, searchRaw)
  );
}
