import type { StockMovementRow } from "./schemas";

export function stockMovementRowKey(row: StockMovementRow): string {
  return `${row.transaction_type}-${row.event_id}`;
}

export function mergeUniqueStockRows(
  base: StockMovementRow[],
  incoming: StockMovementRow[]
): StockMovementRow[] {
  const map = new Map<string, StockMovementRow>();
  for (const row of base) map.set(stockMovementRowKey(row), row);
  for (const row of incoming) map.set(stockMovementRowKey(row), row);
  return [...map.values()];
}
