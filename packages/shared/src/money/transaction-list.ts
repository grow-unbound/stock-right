import { displayMoneyReference, type MoneyMovementRow } from "../api/money";
import { formatDate, formatMoneyListDate } from "../utils/formatting";

export type MoneyChipId = "all" | "receipt" | "payment";

export function moneyRowKey(row: MoneyMovementRow): string {
  return `${row.transaction_type}-${row.event_id}`;
}

export function mergeUniqueMoneyRows(base: MoneyMovementRow[], incoming: MoneyMovementRow[]): MoneyMovementRow[] {
  const map = new Map<string, MoneyMovementRow>();
  for (const row of base) map.set(moneyRowKey(row), row);
  for (const row of incoming) map.set(moneyRowKey(row), row);
  return [...map.values()];
}

export function displayMoneyPartyPrimary(row: MoneyMovementRow): string {
  if (row.transaction_type === "receipt") {
    return row.counterparty_name.trim() || "—";
  }
  const party = row.counterparty_name.trim();
  if (party.length > 0) return party;
  return row.expenditure_head?.trim() || "—";
}

export function displayMoneyPartySecondary(row: MoneyMovementRow): string | null {
  if (row.transaction_type === "receipt") {
    const c = row.customer_code?.trim();
    return c && c.length > 0 ? c : null;
  }
  const n = row.notes?.trim();
  return n && n.length > 0 ? n : null;
}

export function filterMoneyRowsLocal(rows: MoneyMovementRow[], query: string, chip: MoneyChipId): MoneyMovementRow[] {
  const q = query.trim().toLowerCase();
  let next = rows;
  if (chip === "receipt") next = next.filter((r) => r.transaction_type === "receipt");
  else if (chip === "payment") next = next.filter((r) => r.transaction_type === "payment");
  if (q === "") return next;
  return next.filter((row) => rowMatchesMoneyQuery(row, q));
}

function rowMatchesMoneyQuery(row: MoneyMovementRow, q: string): boolean {
  const hay: string[] = [
    displayMoneyReference(row),
    row.counterparty_name,
    row.customer_code ?? "",
    row.payment_method ?? "",
    row.payment_type_name ?? "",
    row.reference_number ?? "",
    row.expenditure_head ?? "",
    row.notes ?? "",
    formatDate(row.occurred_at),
    formatMoneyListDate(row.occurred_at),
    String(row.amount),
  ];
  return hay.some((s) => s.toLowerCase().includes(q));
}
